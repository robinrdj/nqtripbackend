import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers.js";
import { seedFromLegacyJson } from "../src/seed/seed.js";
import { Adventure } from "../src/models/Adventure.js";
import { City } from "../src/models/City.js";
import { ADVENTURE_CATALOGUE, DESTINATIONS } from "../src/seed/catalogue.js";

const destination = (id: string) => DESTINATIONS.find((d) => d.id === id)!;

/** Great-circle distance in km. */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

describe("map coordinates", () => {
  it("places every seeded city at its real centre", async () => {
    await seedFromLegacyJson({ quiet: true, connect: false });

    const response = await request(app()).get("/api/v1/cities").expect(200);

    expect(response.body.items).toHaveLength(DESTINATIONS.length);
    for (const city of response.body.items) {
      expect(city.location, city.id).toEqual(destination(city.id).location);
      expect(city.country).toBe(destination(city.id).country);
      expect(city.photoCredit?.source, city.id).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it("removes retired destinations from an existing database", async () => {
    await City.create({ _id: "bengaluru", city: "Bengaluru", description: "100+ Places", image: "x" });

    await seedFromLegacyJson({ quiet: true, connect: false });

    expect(await City.findById("bengaluru")).toBeNull();
    expect(await City.countDocuments()).toBe(DESTINATIONS.length);
  });

  it("replaces every generated legacy adventure with a real one", async () => {
    await seedFromLegacyJson({ quiet: true, connect: false });

    const adventures = await Adventure.find().lean();
    expect(adventures.length).toBeGreaterThan(0);
    for (const adventure of adventures) {
      const real = ADVENTURE_CATALOGUE[adventure._id];
      expect(real, adventure._id).toBeDefined();
      expect(adventure.name).toBe(real!.name);
      expect(adventure.location).toEqual(real!.location);
    }
  });

  it("gives every adventure credited photos of the place", async () => {
    await seedFromLegacyJson({ quiet: true, connect: false });

    const adventures = await Adventure.find().lean();
    for (const adventure of adventures) {
      expect(adventure.images.length, adventure.name).toBeGreaterThan(0);
      expect(adventure.image).toBe(adventure.images[0]);
      expect(adventure.photoCredits).toHaveLength(adventure.images.length);
      for (const url of adventure.images) {
        expect(url).toMatch(/^https:\/\/(thumb|upload)\.wikimedia\.org\//);
      }
    }
  });

  it("pins every adventure inside its destination", async () => {
    await seedFromLegacyJson({ quiet: true, connect: false });

    const adventures = await Adventure.find().lean();
    for (const adventure of adventures) {
      const centre = destination(adventure.city).location;
      expect(adventure.location, adventure._id).toBeDefined();
      // The furthest are still in the same region: Cape Point from central
      // Cape Town, Dudhsagar and Palolem from Panaji, Tulamben across Bali.
      expect(distanceKm(centre, adventure.location!), adventure.name).toBeLessThan(60);
    }
  });

  it("puts each pin back in the same place on a re-seed", async () => {
    await seedFromLegacyJson({ quiet: true, connect: false });
    const before = await Adventure.find({}, { location: 1 }).sort({ _id: 1 }).lean();

    await seedFromLegacyJson({ quiet: true, connect: false });
    const after = await Adventure.find({}, { location: 1 }).sort({ _id: 1 }).lean();

    expect(after).toEqual(before);
  });

  it("keeps the new fields out of the legacy payloads", async () => {
    await seedFromLegacyJson({ quiet: true, connect: false });

    const cities = await request(app()).get("/cities").expect(200);
    expect(Object.keys(cities.body[0])).toEqual(["id", "city", "description", "image"]);

    const adventures = await request(app()).get("/adventures?city=goa").expect(200);
    expect(adventures.body[0].location).toBeUndefined();
  });
});
