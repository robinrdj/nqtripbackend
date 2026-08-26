import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, daysFromNow, makeAdventure, makeUser } from "./helpers.js";
import { Adventure } from "../src/models/Adventure.js";

describe("POST /api/v1/reservations", () => {
  it("books seats and prices them per head", async () => {
    await makeAdventure({ costPerHead: 1200, capacity: 10 });
    const user = await makeUser();

    const response = await request(app())
      .post("/api/v1/reservations")
      .set("Authorization", user.auth)
      .send({
        adventure: "adv-1",
        name: "  robin   RAJADURAI ",
        date: daysFromNow(7),
        persons: 3,
      })
      .expect(201);

    expect(response.body.reservation).toMatchObject({
      adventureName: "Sunset Kayaking",
      persons: 3,
      price: 3600,
      status: "confirmed",
    });
    // Whitespace collapsed and cased for display.
    expect(response.body.reservation.name).toBe("Robin Rajadurai");
  });

  it("increments the booked count on the adventure", async () => {
    await makeAdventure({ capacity: 10, booked: 0 });
    const user = await makeUser();

    await request(app())
      .post("/api/v1/reservations")
      .set("Authorization", user.auth)
      .send({ adventure: "adv-1", name: "Robin", date: daysFromNow(3), persons: 4 })
      .expect(201);

    const adventure = await Adventure.findById("adv-1");
    expect(adventure?.booked).toBe(4);
  });

  it("refuses to book past the capacity", async () => {
    await makeAdventure({ capacity: 5, booked: 3 });
    const user = await makeUser();

    const response = await request(app())
      .post("/api/v1/reservations")
      .set("Authorization", user.auth)
      .send({ adventure: "adv-1", name: "Robin", date: daysFromNow(3), persons: 4 })
      .expect(409);

    expect(response.body.error.message).toMatch(/2 seats are left/);

    // The failed attempt must not have consumed anything.
    const adventure = await Adventure.findById("adv-1");
    expect(adventure?.booked).toBe(3);
  });

  it("does not oversell the last seats when requests race", async () => {
    // Five seats, five simultaneous two-person bookings: at most two can win.
    await makeAdventure({ capacity: 5, booked: 0 });
    const user = await makeUser();

    const attempts = Array.from({ length: 5 }, () =>
      request(app())
        .post("/api/v1/reservations")
        .set("Authorization", user.auth)
        .send({
          adventure: "adv-1",
          name: "Robin",
          date: daysFromNow(3),
          persons: 2,
        })
    );

    const results = await Promise.all(attempts);
    const created = results.filter((r) => r.status === 201);

    expect(created).toHaveLength(2);

    const adventure = await Adventure.findById("adv-1");
    expect(adventure?.booked).toBe(4);
    expect(adventure!.booked).toBeLessThanOrEqual(adventure!.capacity);
  });

  it("rejects a past date", async () => {
    await makeAdventure();
    const user = await makeUser();

    const response = await request(app())
      .post("/api/v1/reservations")
      .set("Authorization", user.auth)
      .send({ adventure: "adv-1", name: "Robin", date: daysFromNow(-1), persons: 1 })
      .expect(400);

    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ field: "date" })
    );
  });

  it("requires a signed-in user", async () => {
    await makeAdventure();

    await request(app())
      .post("/api/v1/reservations")
      .send({ adventure: "adv-1", name: "Robin", date: daysFromNow(3), persons: 1 })
      .expect(401);
  });

  it("404s for an adventure that does not exist", async () => {
    const user = await makeUser();

    await request(app())
      .post("/api/v1/reservations")
      .set("Authorization", user.auth)
      .send({ adventure: "nope", name: "Robin", date: daysFromNow(3), persons: 1 })
      .expect(404);
  });
});

describe("GET /api/v1/reservations", () => {
  it("returns only the caller's own bookings", async () => {
    await makeAdventure({ capacity: 20 });
    const mine = await makeUser({ email: "mine@test.dev" });
    const theirs = await makeUser({ email: "theirs@test.dev" });

    for (const user of [mine, theirs]) {
      await request(app())
        .post("/api/v1/reservations")
        .set("Authorization", user.auth)
        .send({
          adventure: "adv-1",
          name: user.email,
          date: daysFromNow(5),
          persons: 1,
        })
        .expect(201);
    }

    const response = await request(app())
      .get("/api/v1/reservations")
      .set("Authorization", mine.auth)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items[0].name).toBe("Mine@test.dev");
  });
});

describe("POST /api/v1/reservations/:id/cancel", () => {
  it("frees the seats back up", async () => {
    await makeAdventure({ capacity: 10, booked: 0 });
    const user = await makeUser();

    const booking = await request(app())
      .post("/api/v1/reservations")
      .set("Authorization", user.auth)
      .send({ adventure: "adv-1", name: "Robin", date: daysFromNow(5), persons: 3 })
      .expect(201);

    await request(app())
      .post(`/api/v1/reservations/${booking.body.reservation.id}/cancel`)
      .set("Authorization", user.auth)
      .expect(200);

    const adventure = await Adventure.findById("adv-1");
    expect(adventure?.booked).toBe(0);
  });

  it("will not let someone cancel a booking that is not theirs", async () => {
    await makeAdventure({ capacity: 10 });
    const owner = await makeUser({ email: "owner@test.dev" });
    const stranger = await makeUser({ email: "stranger@test.dev" });

    const booking = await request(app())
      .post("/api/v1/reservations")
      .set("Authorization", owner.auth)
      .send({ adventure: "adv-1", name: "Robin", date: daysFromNow(5), persons: 1 })
      .expect(201);

    await request(app())
      .post(`/api/v1/reservations/${booking.body.reservation.id}/cancel`)
      .set("Authorization", stranger.auth)
      .expect(403);

    const adventure = await Adventure.findById("adv-1");
    expect(adventure?.booked).toBe(1);
  });

  it("refuses to cancel twice", async () => {
    await makeAdventure({ capacity: 10 });
    const user = await makeUser();

    const booking = await request(app())
      .post("/api/v1/reservations")
      .set("Authorization", user.auth)
      .send({ adventure: "adv-1", name: "Robin", date: daysFromNow(5), persons: 2 })
      .expect(201);

    const id = booking.body.reservation.id;

    await request(app())
      .post(`/api/v1/reservations/${id}/cancel`)
      .set("Authorization", user.auth)
      .expect(200);

    await request(app())
      .post(`/api/v1/reservations/${id}/cancel`)
      .set("Authorization", user.auth)
      .expect(409);

    // The second attempt must not have decremented the count a second time.
    const adventure = await Adventure.findById("adv-1");
    expect(adventure?.booked).toBe(0);
  });
});
