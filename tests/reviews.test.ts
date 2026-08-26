import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, daysFromNow, makeAdventure, makeUser, type TestUser } from "./helpers.js";
import { Adventure } from "../src/models/Adventure.js";

/** Reviews are gated on having booked, so most tests need a booking first. */
async function book(user: TestUser, persons = 1) {
  await request(app())
    .post("/api/v1/reservations")
    .set("Authorization", user.auth)
    .send({ adventure: "adv-1", name: "Robin", date: daysFromNow(5), persons })
    .expect(201);
}

describe("POST /api/v1/adventures/:id/reviews", () => {
  beforeEach(async () => {
    await makeAdventure({ capacity: 50 });
  });

  it("accepts a review from someone who booked", async () => {
    const user = await makeUser();
    await book(user);

    const response = await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .set("Authorization", user.auth)
      .send({ rating: 5, title: "Superb", body: "Genuinely worth the early start." })
      .expect(201);

    expect(response.body.review).toMatchObject({ rating: 5, title: "Superb" });
  });

  it("refuses a review from someone who never booked", async () => {
    const user = await makeUser();

    const response = await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .set("Authorization", user.auth)
      .send({ rating: 5, body: "Never actually went on this one." })
      .expect(403);

    expect(response.body.error.message).toMatch(/once you have booked/i);
  });

  it("updates the adventure's aggregate rating", async () => {
    const one = await makeUser({ email: "one@test.dev" });
    const two = await makeUser({ email: "two@test.dev" });
    await book(one);
    await book(two);

    for (const [user, rating] of [
      [one, 5],
      [two, 4],
    ] as const) {
      await request(app())
        .post("/api/v1/adventures/adv-1/reviews")
        .set("Authorization", user.auth)
        .send({ rating, body: "A perfectly reasonable review body." })
        .expect(201);
    }

    const adventure = await Adventure.findById("adv-1");
    expect(adventure?.ratingAverage).toBe(4.5);
    expect(adventure?.ratingCount).toBe(2);
  });

  it("replaces a second review by the same person rather than adding one", async () => {
    const user = await makeUser();
    await book(user);

    await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .set("Authorization", user.auth)
      .send({ rating: 2, body: "First impression was not great." })
      .expect(201);

    await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .set("Authorization", user.auth)
      .send({ rating: 5, body: "Changed my mind entirely on reflection." })
      .expect(201);

    const adventure = await Adventure.findById("adv-1");
    expect(adventure?.ratingCount).toBe(1);
    expect(adventure?.ratingAverage).toBe(5);
  });

  it("rejects an out-of-range rating", async () => {
    const user = await makeUser();
    await book(user);

    await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .set("Authorization", user.auth)
      .send({ rating: 9, body: "Off the scale, apparently." })
      .expect(400);
  });

  it("rejects a review that is too short", async () => {
    const user = await makeUser();
    await book(user);

    await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .set("Authorization", user.auth)
      .send({ rating: 4, body: "Good" })
      .expect(400);
  });

  it("requires a signed-in user", async () => {
    await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .send({ rating: 4, body: "Anonymous praise, of a sort." })
      .expect(401);
  });
});

describe("GET /api/v1/adventures/:id/reviews", () => {
  beforeEach(async () => {
    await makeAdventure({ capacity: 50 });
  });

  it("returns a full five-bucket distribution", async () => {
    const user = await makeUser();
    await book(user);
    await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .set("Authorization", user.auth)
      .send({ rating: 4, body: "A perfectly reasonable review body." })
      .expect(201);

    const response = await request(app())
      .get("/api/v1/adventures/adv-1/reviews")
      .expect(200);

    expect(response.body.total).toBe(1);
    // Every bucket present, so the histogram needs no gap-filling client-side.
    expect(response.body.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 });
  });

  it("includes the reviewer's name but not their email", async () => {
    const user = await makeUser();
    await book(user);
    await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .set("Authorization", user.auth)
      .send({ rating: 4, body: "A perfectly reasonable review body." })
      .expect(201);

    const response = await request(app())
      .get("/api/v1/adventures/adv-1/reviews")
      .expect(200);

    expect(response.body.items[0].user.name).toBe("Test User");
    expect(JSON.stringify(response.body)).not.toContain(user.email);
  });
});

describe("DELETE /api/v1/reviews/:id", () => {
  beforeEach(async () => {
    await makeAdventure({ capacity: 50 });
  });

  it("lets the author delete and recomputes the rating", async () => {
    const user = await makeUser();
    await book(user);

    const created = await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .set("Authorization", user.auth)
      .send({ rating: 5, body: "A perfectly reasonable review body." })
      .expect(201);

    await request(app())
      .delete(`/api/v1/reviews/${created.body.review.id}`)
      .set("Authorization", user.auth)
      .expect(204);

    const adventure = await Adventure.findById("adv-1");
    expect(adventure?.ratingCount).toBe(0);
    expect(adventure?.ratingAverage).toBe(0);
  });

  it("will not let someone delete another person's review", async () => {
    const author = await makeUser({ email: "author@test.dev" });
    const stranger = await makeUser({ email: "stranger@test.dev" });
    await book(author);

    const created = await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .set("Authorization", author.auth)
      .send({ rating: 5, body: "A perfectly reasonable review body." })
      .expect(201);

    await request(app())
      .delete(`/api/v1/reviews/${created.body.review.id}`)
      .set("Authorization", stranger.auth)
      .expect(403);
  });

  it("lets an admin delete anyone's review", async () => {
    const author = await makeUser({ email: "author2@test.dev" });
    const admin = await makeUser({ email: "admin@test.dev", role: "admin" });
    await book(author);

    const created = await request(app())
      .post("/api/v1/adventures/adv-1/reviews")
      .set("Authorization", author.auth)
      .send({ rating: 5, body: "A perfectly reasonable review body." })
      .expect(201);

    await request(app())
      .delete(`/api/v1/reviews/${created.body.review.id}`)
      .set("Authorization", admin.auth)
      .expect(204);
  });
});

describe("POST /api/v1/wishlist/:adventureId", () => {
  beforeEach(async () => {
    await makeAdventure();
  });

  it("toggles on and back off", async () => {
    const user = await makeUser();

    const on = await request(app())
      .post("/api/v1/wishlist/adv-1")
      .set("Authorization", user.auth)
      .expect(200);
    expect(on.body.saved).toBe(true);

    const off = await request(app())
      .post("/api/v1/wishlist/adv-1")
      .set("Authorization", user.auth)
      .expect(200);
    expect(off.body.saved).toBe(false);
  });

  it("lists saved adventures", async () => {
    const user = await makeUser();
    await request(app())
      .post("/api/v1/wishlist/adv-1")
      .set("Authorization", user.auth)
      .expect(200);

    const response = await request(app())
      .get("/api/v1/wishlist")
      .set("Authorization", user.auth)
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].name).toBe("Sunset Kayaking");
  });

  it("404s for an adventure that does not exist", async () => {
    const user = await makeUser();
    await request(app())
      .post("/api/v1/wishlist/nope")
      .set("Authorization", user.auth)
      .expect(404);
  });

  it("requires a signed-in user", async () => {
    await request(app()).post("/api/v1/wishlist/adv-1").expect(401);
  });
});
