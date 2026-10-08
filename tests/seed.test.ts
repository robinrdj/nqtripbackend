/**
 * Runs the real seed (catalogue, photos and the legacy db.json) in memory.
 *
 * This is the test that matters before pointing the seed at Atlas: it proves
 * the data actually lands as valid documents, rather than discovering a bad
 * record halfway through writing to the live database.
 */
import { describe, expect, it } from "vitest";
import request from "supertest";
import { seedFromLegacyJson } from "../src/seed/seed.js";
import { Adventure } from "../src/models/Adventure.js";
import { City } from "../src/models/City.js";
import { Reservation } from "../src/models/Reservation.js";
import { User } from "../src/models/User.js";
import { app } from "./helpers.js";
import { DESTINATIONS } from "../src/seed/catalogue.js";

async function runSeed() {
  // `connect: false` - the suite already holds an open connection.
  await seedFromLegacyJson({ quiet: true, connect: false });
}

describe("seedFromLegacyJson", () => {
  it("migrates cities, adventures and reservations", async () => {
    await runSeed();

    expect(await City.countDocuments()).toBe(DESTINATIONS.length);
    expect(await Adventure.countDocuments()).toBeGreaterThan(50);
    expect(await Reservation.countDocuments()).toBe(8);
  });

  it("keeps the original identifiers, so old URLs still resolve", async () => {
    await runSeed();

    const goa = await City.findById("goa");
    expect(goa?.city).toBe("Goa");

    // A legacy numeric adventure id from db.json.
    const adventure = await Adventure.findById("2447910730");
    expect(adventure).not.toBeNull();
    expect(adventure?.city).toBe("manali");
  });

  it("writes every field the card and detail views need", async () => {
    await runSeed();

    const adventure = await Adventure.findById("2447910730");
    expect(adventure?.category).toBeTruthy();
    expect(adventure?.duration).toBeGreaterThan(0);
    expect(adventure?.content.length).toBeGreaterThan(50);
  });

  it("gives every adventure a usable image list", async () => {
    await runSeed();

    const withNulls = await Adventure.find({ images: null }).lean();
    expect(withNulls).toHaveLength(0);

    const all = await Adventure.find().lean();
    for (const adventure of all) {
      expect(adventure.images.every((i) => typeof i === "string" && i !== "")).toBe(true);
      expect(adventure.image).toBeTruthy();
    }
  });

  it("gives every adventure a valid category and non-zero capacity", async () => {
    await runSeed();

    const all = await Adventure.find().lean();
    for (const adventure of all) {
      expect(["Beaches", "Cycling", "Hillside", "Party"]).toContain(adventure.category);
      expect(adventure.capacity).toBeGreaterThan(0);
      expect(adventure.booked).toBeLessThanOrEqual(adventure.capacity);
    }
  });

  it("creates the demo accounts with usable passwords", async () => {
    await runSeed();

    expect(await User.countDocuments()).toBe(2);

    const admin = await User.findOne({ email: "admin@qtrip.dev" });
    expect(admin?.role).toBe("admin");

    // The credentials printed in the README have to actually work.
    await request(app())
      .post("/api/v1/auth/login")
      .send({ email: "demo@qtrip.dev", password: "Demo1234" })
      .expect(200);
  });

  it("is idempotent - re-running creates no duplicates", async () => {
    await runSeed();
    const first = {
      cities: await City.countDocuments(),
      adventures: await Adventure.countDocuments(),
      reservations: await Reservation.countDocuments(),
      users: await User.countDocuments(),
    };

    await runSeed();

    expect({
      cities: await City.countDocuments(),
      adventures: await Adventure.countDocuments(),
      reservations: await Reservation.countDocuments(),
      users: await User.countDocuments(),
    }).toEqual(first);
  });

  it("preserves booking dates exactly, with no timezone drift", async () => {
    await runSeed();

    const reservation = await Reservation.findOne({ name: "Robin Rajadurai J" });
    expect(reservation).not.toBeNull();
    // db.json records this booking as 2023-03-30; it must read back as that day.
    expect(reservation!.date.toISOString().slice(0, 10)).toBe("2023-03-30");
  });

  it("leaves the migrated reservations unowned", async () => {
    await runSeed();

    // They predate accounts, so they must not be attributed to a real user.
    const owned = await Reservation.countDocuments({ user: { $exists: true } });
    expect(owned).toBe(0);
  });

  it("serves the migrated data through the legacy endpoints", async () => {
    await runSeed();

    const cities = await request(app()).get("/cities").expect(200);
    expect(cities.body).toHaveLength(DESTINATIONS.length);

    const adventures = await request(app())
      .get("/adventures?city=manali")
      .expect(200);
    expect(adventures.body.length).toBeGreaterThan(0);

    const detail = await request(app())
      .get("/adventures/detail?adventure=2447910730")
      .expect(200);
    expect(detail.body.id).toBe("2447910730");
  });
});
