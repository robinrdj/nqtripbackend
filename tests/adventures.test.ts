import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, makeAdventure, makeCity, makeUser } from "./helpers.js";

async function seedCatalogue() {
  await makeCity();
  await makeCity({ _id: "goa2", city: "Elsewhere" });

  await makeAdventure({ _id: "a1", name: "Alpha", category: "Beaches", duration: 2, costPerHead: 500, ratingAverage: 4.5, ratingCount: 10 });
  await makeAdventure({ _id: "a2", name: "Bravo", category: "Party", duration: 6, costPerHead: 2000, ratingAverage: 3.0, ratingCount: 2 });
  await makeAdventure({ _id: "a3", name: "Charlie", category: "Cycling", duration: 12, costPerHead: 900, ratingAverage: 5.0, ratingCount: 1 });
  await makeAdventure({ _id: "a4", name: "Delta", category: "Beaches", duration: 20, costPerHead: 4000 });
  await makeAdventure({ _id: "b1", name: "Foxtrot", city: "goa2", category: "Party", duration: 3, costPerHead: 100 });
}

describe("GET /api/v1/adventures", () => {
  beforeEach(seedCatalogue);

  it("filters by city", async () => {
    const response = await request(app())
      .get("/api/v1/adventures?city=goa")
      .expect(200);

    expect(response.body.total).toBe(4);
    expect(response.body.items.map((a: { id: string }) => a.id)).not.toContain("b1");
  });

  it("filters by multiple categories", async () => {
    const response = await request(app())
      .get("/api/v1/adventures?city=goa&category=Beaches,Party")
      .expect(200);

    expect(response.body.total).toBe(3);
  });

  it("filters by a duration range", async () => {
    const response = await request(app())
      .get("/api/v1/adventures?city=goa&durationMin=3&durationMax=15")
      .expect(200);

    expect(response.body.items.map((a: { name: string }) => a.name).sort()).toEqual([
      "Bravo",
      "Charlie",
    ]);
  });

  it("filters by a price range", async () => {
    const response = await request(app())
      .get("/api/v1/adventures?city=goa&priceMin=600&priceMax=2500")
      .expect(200);

    expect(response.body.items.map((a: { name: string }) => a.name).sort()).toEqual([
      "Bravo",
      "Charlie",
    ]);
  });

  it("sorts by price ascending", async () => {
    const response = await request(app())
      .get("/api/v1/adventures?city=goa&sort=price-asc")
      .expect(200);

    const prices = response.body.items.map((a: { costPerHead: number }) => a.costPerHead);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("paginates", async () => {
    const response = await request(app())
      .get("/api/v1/adventures?city=goa&limit=2&page=2")
      .expect(200);

    expect(response.body.items).toHaveLength(2);
    expect(response.body).toMatchObject({ page: 2, limit: 2, total: 4, totalPages: 2 });
  });

  it("matches a partial search term", async () => {
    const response = await request(app())
      .get("/api/v1/adventures?city=goa&q=char")
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].name).toBe("Charlie");
  });

  it("treats regex characters in the search term literally", async () => {
    // Without escaping, ".*" would match every adventure instead of none.
    const response = await request(app())
      .get("/api/v1/adventures?city=goa&q=.*")
      .expect(200);

    expect(response.body.total).toBe(0);
  });

  it("returns category facet counts that ignore the category filter", async () => {
    const response = await request(app())
      .get("/api/v1/adventures?city=goa&category=Party")
      .expect(200);

    // Only Party matched, but the facets still describe what else is available.
    expect(response.body.total).toBe(1);
    const beaches = response.body.facets.categories.find(
      (c: { value: string }) => c.value === "Beaches"
    );
    expect(beaches.count).toBe(2);
  });

  it("rejects an inverted duration range", async () => {
    await request(app())
      .get("/api/v1/adventures?city=goa&durationMin=10&durationMax=2")
      .expect(400);
  });

  it("rejects an unknown category", async () => {
    await request(app())
      .get("/api/v1/adventures?city=goa&category=Skydiving")
      .expect(400);
  });

  it("caps the page size", async () => {
    await request(app()).get("/api/v1/adventures?limit=5000").expect(400);
  });
});

describe("GET /api/v1/adventures/:id", () => {
  beforeEach(seedCatalogue);

  it("returns one adventure with derived seat counts", async () => {
    const response = await request(app()).get("/api/v1/adventures/a1").expect(200);

    expect(response.body.adventure).toMatchObject({
      id: "a1",
      name: "Alpha",
      seatsLeft: 10,
      available: true,
    });
  });

  it("404s for an unknown id", async () => {
    const response = await request(app())
      .get("/api/v1/adventures/does-not-exist")
      .expect(404);

    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("reports whether the caller has saved it", async () => {
    const user = await makeUser();

    const before = await request(app())
      .get("/api/v1/adventures/a1")
      .set("Authorization", user.auth)
      .expect(200);
    expect(before.body.saved).toBe(false);

    await request(app())
      .post("/api/v1/wishlist/a1")
      .set("Authorization", user.auth)
      .expect(200);

    const after = await request(app())
      .get("/api/v1/adventures/a1")
      .set("Authorization", user.auth)
      .expect(200);
    expect(after.body.saved).toBe(true);
  });
});

describe("GET /api/v1/cities", () => {
  it("lists cities", async () => {
    await seedCatalogue();
    const response = await request(app()).get("/api/v1/cities").expect(200);
    expect(response.body.items).toHaveLength(2);
  });
});
