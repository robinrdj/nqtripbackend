/**
 * Migrates the original lowdb `db.json` into MongoDB.
 *
 * Run with: npm run seed        (adds anything missing, leaves the rest alone)
 *           npm run seed:fresh  (drops the collections first)
 *
 * The script is idempotent: identifiers carry over from the JSON file
 * unchanged, so re-running it updates the same documents rather than creating
 * duplicates. That matters because the seed is also what populates a fresh
 * Atlas database on first deploy.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mongoose from "mongoose";
import { connectToDatabase, disconnectFromDatabase } from "../db/connect.js";
import { Adventure, ADVENTURE_CATEGORIES } from "../models/Adventure.js";
import type { AdventureCategory } from "../models/Adventure.js";
import { City } from "../models/City.js";
import { Reservation } from "../models/Reservation.js";
import { Review } from "../models/Review.js";
import { User, hashPassword } from "../models/User.js";
import { Wishlist } from "../models/Wishlist.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DB_JSON = path.resolve(here, "../../db.json");

interface LegacyCity {
  id: string;
  city: string;
  description: string;
  image: string;
}

interface LegacyAdventure {
  id: string;
  name: string;
  costPerHead: number;
  currency: string;
  image: string;
  duration: number;
  category: string;
}

interface LegacyDetail {
  id: string;
  name: string;
  subtitle: string;
  images: (string | null)[];
  content: string;
  available: boolean;
  reserved: boolean;
  costPerHead: number;
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
  cities: LegacyCity[];
  adventures: { id: string; adventures: LegacyAdventure[] }[];
  detail: LegacyDetail[];
  reservations: LegacyReservation[];
}

const FALLBACK_IMAGE =
  "https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750";

function toCategory(value: string): AdventureCategory {
  return (ADVENTURE_CATEGORIES as readonly string[]).includes(value)
    ? (value as AdventureCategory)
    : "Party";
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

  // --- Cities -------------------------------------------------------------
  const adventureCountByCity = new Map<string, number>();
  for (const group of raw.adventures) {
    adventureCountByCity.set(group.id, group.adventures.length);
  }

  await City.bulkWrite(
    raw.cities.map((city) => ({
      updateOne: {
        filter: { _id: city.id },
        update: {
          $set: {
            city: city.city,
            description: city.description,
            image: city.image,
            adventureCount: adventureCountByCity.get(city.id) ?? 0,
          },
        },
        upsert: true,
      },
    }))
  );
  log(`[seed] cities: ${raw.cities.length}`);

  // --- Adventures ---------------------------------------------------------
  // The old data split each adventure across `adventures` (card fields) and
  // `detail` (prose). Merge them back into one document, keyed by the id both
  // halves already shared.
  const detailById = new Map(raw.detail.map((d) => [d.id, d]));

  const adventureOps = [];
  let orphanedDetails = 0;

  for (const group of raw.adventures) {
    for (const item of group.adventures) {
      const detail = detailById.get(item.id);
      if (!detail) orphanedDetails += 1;

      // Some seed rows contain nulls in the image array.
      const images = (detail?.images ?? [])
        .filter((img): img is string => typeof img === "string" && img !== "")
        .slice(0, 6);

      const capacity = 10 + ((hashString(item.id) % 5) * 5); // 10..30, stable
      // Carry the old boolean forward as a plausible starting occupancy rather
      // than discarding it: previously "reserved" adventures start part-booked.
      const booked = detail?.reserved ? Math.min(capacity, 1 + (hashString(item.id) % 4)) : 0;

      adventureOps.push({
        updateOne: {
          filter: { _id: item.id },
          update: {
            $set: {
              city: group.id,
              name: item.name,
              subtitle: detail?.subtitle ?? "",
              content: detail?.content ?? "",
              image: item.image || images[0] || FALLBACK_IMAGE,
              images: images.length > 0 ? images : [item.image || FALLBACK_IMAGE],
              category: toCategory(item.category),
              duration: item.duration,
              costPerHead: item.costPerHead,
              currency: item.currency || "INR",
              capacity,
            },
            $setOnInsert: { booked },
          },
          upsert: true,
        },
      });
    }
  }

  await Adventure.bulkWrite(adventureOps);
  log(
    `[seed] adventures: ${adventureOps.length}` +
      (orphanedDetails > 0 ? ` (${orphanedDetails} had no detail record)` : "")
  );

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
          adventureName: r.adventureName,
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
