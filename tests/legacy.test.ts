/**
 * The deployed frontend still calls these paths. Every assertion here is about
 * payload compatibility with the old lowdb server, so that migrating the client
 * can happen separately from migrating the data.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, makeAdventure, makeCity } from "./helpers.js";
import { Adventure } from "../src/models/Adventure.js";

describe("GET /cities", () => {
  it("returns a bare array with exactly the old four keys", async () => {
    await makeCity();

    const response = await request(app()).get("/cities").expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(Object.keys(response.body[0]).sort()).toEqual([
      "city",
      "description",
      "id",
      "image",
    ]);
  });
});

describe("GET /adventures", () => {
  beforeEach(async () => {
    await makeCity();
    await makeAdventure();
  });

  it("returns the card fields for a city", async () => {
    const response = await request(app())
      .get("/adventures?city=goa")
      .expect(200);

    expect(Object.keys(response.body[0]).sort()).toEqual([
      "category",
      "costPerHead",
      "currency",
      "duration",
      "id",
      "image",
      "name",
    ]);
  });

  it("400s with the old message when the city has none", async () => {
    const response = await request(app())
      .get("/adventures?city=nowhere")
      .expect(400);

    expect(response.body.message).toBe("Adventure not found for nowhere!");
  });
});

describe("GET /adventures/detail", () => {
  beforeEach(async () => {
    await makeCity();
    await makeAdventure();
  });

  it("returns the detail shape, including the legacy booleans", async () => {
    const response = await request(app())
      .get("/adventures/detail?adventure=adv-1")
      .expect(200);

    expect(Object.keys(response.body).sort()).toEqual([
      "available",
      "content",
      "costPerHead",
      "id",
      "images",
      "name",
      "reserved",
      "subtitle",
    ]);
    expect(response.body.available).toBe(true);
    expect(response.body.reserved).toBe(false);
  });

  it("derives reserved/available from the seat counts", async () => {
    await Adventure.updateOne({ _id: "adv-1" }, { $set: { booked: 10, capacity: 10 } });

    const response = await request(app())
      .get("/adventures/detail?adventure=adv-1")
      .expect(200);

    expect(response.body.available).toBe(false);
    expect(response.body.reserved).toBe(true);
  });

  it("400s with the old message for an unknown id", async () => {
    const response = await request(app())
      .get("/adventures/detail?adventure=nope")
      .expect(400);

    expect(response.body.message).toBe("Adventure details not found for nope!");
  });
});

describe("POST /reservations/new", () => {
  beforeEach(async () => {
    await makeCity();
    await makeAdventure({ capacity: 20 });
  });

  it("books anonymously and answers { success: true }", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await request(app())
      .post("/reservations/new")
      .send({
        name: "Rahul",
        date: tomorrow.toISOString().slice(0, 10),
        person: "02",
        adventure: "adv-1",
      })
      .expect(200);

    expect(response.body).toEqual({ success: true });

    const adventure = await Adventure.findById("adv-1");
    expect(adventure?.booked).toBe(2);
  });

  it("rejects a missing field with the old message", async () => {
    const response = await request(app())
      .post("/reservations/new")
      .send({ name: "Rahul", person: "02", adventure: "adv-1" })
      .expect(400);

    expect(response.body.message).toBe("Invalid data received");
  });

  it("rejects a past date with the old message", async () => {
    const response = await request(app())
      .post("/reservations/new")
      .send({
        name: "Rahul",
        date: "2020-01-01",
        person: "02",
        adventure: "adv-1",
      })
      .expect(400);

    expect(response.body.message).toBe(
      "Date of booking is incorrect. Can't book for a past date!"
    );
  });
});

describe("GET /reservations", () => {
  it("returns the old row shape, with a zero-padded person count", async () => {
    await makeCity();
    await makeAdventure({ capacity: 20 });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    await request(app())
      .post("/reservations/new")
      .send({ name: "Rahul", date, person: "2", adventure: "adv-1" })
      .expect(200);

    const response = await request(app()).get("/reservations").expect(200);

    expect(Object.keys(response.body[0]).sort()).toEqual([
      "adventure",
      "adventureName",
      "date",
      "id",
      "name",
      "person",
      "price",
      "time",
    ]);
    expect(response.body[0].person).toBe("02");
    expect(response.body[0].date).toBe(date);
  });
});

describe("GET /health", () => {
  it("reports the database connection", async () => {
    const response = await request(app()).get("/health").expect(200);
    expect(response.body).toMatchObject({ status: "ok", database: "connected" });
  });
});
