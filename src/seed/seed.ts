/**
 * Seeds MongoDB with the app's destinations and adventures, plus the demo
 * accounts and the reservations migrated from the original lowdb `db.json`.
 *
 * Run with: npm run seed        (adds anything missing, leaves the rest alone)
 *           npm run seed:fresh  (drops the collections first)
 *
 * Destinations and adventures come from `catalogue.ts`, with photos from
 * `photos.ts`. `db.json` still supplies the reservations and each legacy
 * adventure's booking state, keyed by the ids the catalogue kept.
 *
 * The script is idempotent: re-running it updates the same documents rather
 * than creating duplicates. That matters because the seed is also what
 * populates a fresh Atlas database on first deploy.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mongoose from "mongoose";
import { connectToDatabase, disconnectFromDatabase } from "../db/connect.js";
import { Adventure } from "../models/Adventure.js";
import type { AdventureDoc } from "../models/Adventure.js";
import { City } from "../models/City.js";
import { Reservation } from "../models/Reservation.js";
import { Review } from "../models/Review.js";
import { User, hashPassword } from "../models/User.js";
import { Wishlist } from "../models/Wishlist.js";
import { ADVENTURE_CATALOGUE, DESTINATIONS } from "./catalogue.js";
import { ADVENTURE_PHOTOS, DESTINATION_PHOTOS, type Photo } from "./photos.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DB_JSON = path.resolve(here, "../../db.json");

interface LegacyDetail {
  id: string;
  reserved: boolean;
}

interface LegacyReservation {
  id: string;
  name: string;
  date: string;
  person: string;
  adventure: string;
  adventureName: string;
  price: number;
  time: string;
}

interface LegacyDb {
  detail: LegacyDetail[];
  reservations: LegacyReservation[];
}

const FALLBACK_IMAGE =
  "https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750";

/** Plain objects are what gets written; the inferred type is the hydrated DocumentArray. */
function toCredits(photos: Photo[]) {
  return photos.map(({ author, license, source }) => ({
    author,
    license,
    source,
  })) as unknown as AdventureDoc["photoCredits"];
}

export interface SeedOptions {
  /** Drop every collection first. */
  fresh?: boolean;
  /** Suppress progress output - the test suite seeds on every run. */
  quiet?: boolean;
  /** Skip connecting, for callers that already hold an open connection. */
  connect?: boolean;
}

export async function seedFromLegacyJson(options: SeedOptions = {}): Promise<void> {
  const { fresh = false, quiet = false, connect = true } = options;
  const log = quiet ? () => {} : console.log;

  const raw = JSON.parse(readFileSync(DB_JSON, "utf8")) as LegacyDb;

  if (connect) {
    await connectToDatabase();
    log(`[seed] connected to ${mongoose.connection.name}`);
  }

  if (fresh) {
    log("[seed] --fresh: dropping collections");
    await Promise.all([
      City.deleteMany({}),
      Adventure.deleteMany({}),
      Reservation.deleteMany({}),
      Review.deleteMany({}),
      Wishlist.deleteMany({}),
      User.deleteMany({}),
    ]);
  }

  const adventures = Object.entries(ADVENTURE_CATALOGUE);

  // --- Cities -------------------------------------------------------------
  const adventureCountByCity = new Map<string, number>();
  for (const [, adventure] of adventures) {
    adventureCountByCity.set(adventure.city, (adventureCountByCity.get(adventure.city) ?? 0) + 1);
  }

  await City.bulkWrite(
    DESTINATIONS.map((destination) => {
      const photo = DESTINATION_PHOTOS[destination.id];
      return {
        updateOne: {
          filter: { _id: destination.id },
          update: {
            $set: {
              city: destination.city,
              country: destination.country,
              description: destination.description,
              location: destination.location,
              adventureCount: adventureCountByCity.get(destination.id) ?? 0,
              ...(photo
                ? {
                    image: photo.url,
                    photoCredit: {
                      author: photo.author,
                      license: photo.license,
                      source: photo.source,
                    },
                  }
                : {}),
            },
          },
          upsert: true,
        },
      };
    })
  );

  // Destinations dropped from the catalogue (the original Bengaluru, Kolkata,
  // Malaysia, Bangkok, New York and Paris) would otherwise linger with no
  // adventures, since every adventure id now points at a current destination.
  const removed = await City.deleteMany({ _id: { $nin: DESTINATIONS.map((d) => d.id) } });
  log(
    `[seed] cities: ${DESTINATIONS.length}` +
      (removed.deletedCount > 0 ? ` (removed ${removed.deletedCount} retired)` : "")
  );

  // --- Adventures ---------------------------------------------------------
  const reservedById = new Map(raw.detail.map((d) => [d.id, d.reserved]));

  const adventureOps = adventures.map(([id, adventure]) => {
    const capacity = 10 + ((hashString(id) % 5) * 5); // 10..30, stable
    // Carry the old boolean forward as a plausible starting occupancy rather
    // than discarding it: previously "reserved" adventures start part-booked.
    const booked = reservedById.get(id) ? Math.min(capacity, 1 + (hashString(id) % 4)) : 0;
    const photos = ADVENTURE_PHOTOS[id] ?? [];

    return {
      updateOne: {
        filter: { _id: id },
        update: {
          $set: {
            city: adventure.city,
            name: adventure.name,
            subtitle: adventure.subtitle,
            content: adventure.content,
            image: photos[0]?.url ?? FALLBACK_IMAGE,
            images: photos.length > 0 ? photos.map((p) => p.url) : [FALLBACK_IMAGE],
            photoCredits: toCredits(photos),
            category: adventure.category,
            duration: adventure.duration,
            costPerHead: adventure.costPerHead,
            currency: "INR",
            capacity,
            location: adventure.location,
          },
          $setOnInsert: { booked },
        },
        upsert: true,
      },
    };
  });

  await Adventure.bulkWrite(adventureOps);
  log(`[seed] adventures: ${adventureOps.length}`);

  // --- Demo accounts ------------------------------------------------------
  // A recruiter should be able to sign in and click around without registering.
  const demoAccounts: {
    name: string;
    email: string;
    password: string;
    role: "user" | "admin";
  }[] = [
    { name: "Demo Traveller", email: "demo@qtrip.dev", password: "Demo1234", role: "user" },
    { name: "Robin Rajadurai", email: "admin@qtrip.dev", password: "Admin1234", role: "admin" },
  ];

  const users = new Map<string, mongoose.Types.ObjectId>();

  for (const account of demoAccounts) {
    const existing = await User.findOne({ email: account.email });
    if (existing) {
      users.set(account.email, existing._id);
      continue;
    }
    const created = await User.create({
      name: account.name,
      email: account.email,
      passwordHash: await hashPassword(account.password),
      role: account.role,
    });
    users.set(account.email, created._id);
  }
  log(`[seed] demo accounts: ${demoAccounts.map((a) => a.email).join(", ")}`);

  // --- Reservations -------------------------------------------------------
  // The original rows have no owner, so they stay unowned and surface only in
  // the legacy endpoint. `person` was a zero-padded string ("02").
  const reservationOps = raw.reservations.map((r) => ({
    updateOne: {
      filter: { _id: legacyObjectId(r.id) },
      update: {
        $set: {
          adventure: r.adventure,
          adventureName: ADVENTURE_CATALOGUE[r.adventure]?.name ?? r.adventureName,
          name: r.name,
          date: new Date(`${r.date}T00:00:00.000Z`),
          persons: Math.max(1, Number.parseInt(r.person, 10) || 1),
          price: r.price,
          status: "confirmed" as const,
          createdAt: new Date(r.time),
        },
      },
      upsert: true,
    },
  }));

  if (reservationOps.length > 0) {
    await Reservation.bulkWrite(reservationOps, { ordered: false });
  }
  log(`[seed] reservations: ${reservationOps.length}`);

  if (connect) await disconnectFromDatabase();
  log("[seed] done");
}

/**
 * The legacy ids are 16 hex characters; an ObjectId is 24. Left-padding keeps
 * the original id visible inside the new one, so a row can still be traced back
 * to the JSON it came from, and keeps re-runs idempotent.
 */
function legacyObjectId(legacyId: string): mongoose.Types.ObjectId {
  const hex = legacyId.replace(/[^0-9a-f]/gi, "").slice(0, 24);
  return new mongoose.Types.ObjectId(hex.padStart(24, "0"));
}

/** Deterministic so re-seeding does not shuffle capacities. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Only run as a script; importing the module (as the tests do) must not
// connect or mutate anything on its own.
const invokedDirectly = process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  seedFromLegacyJson({ fresh: process.argv.includes("--fresh") }).catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
}
