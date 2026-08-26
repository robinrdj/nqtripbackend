import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Adventure } from "../src/models/Adventure.js";
import { City } from "../src/models/City.js";
import { User, hashPassword } from "../src/models/User.js";

let cachedApp: Express | undefined;

/** One app instance per process; building it per test is pure overhead. */
export function app(): Express {
  cachedApp ??= createApp();
  return cachedApp;
}

export async function makeCity(overrides: Partial<Record<string, unknown>> = {}) {
  return City.create({
    _id: "goa",
    city: "Goa",
    description: "250+ Places",
    image: "https://example.test/goa.jpg",
    ...overrides,
  });
}

export async function makeAdventure(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return Adventure.create({
    _id: "adv-1",
    city: "goa",
    name: "Sunset Kayaking",
    subtitle: "Paddle out at golden hour",
    content: "A long description.",
    image: "https://example.test/kayak.jpg",
    images: ["https://example.test/kayak.jpg"],
    category: "Beaches",
    duration: 4,
    costPerHead: 1200,
    capacity: 10,
    booked: 0,
    ...overrides,
  });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  /** Ready to pass to `.set("Authorization", user.auth)`. */
  auth: string;
}

/**
 * Creates a user and signs in as them.
 *
 * Uses the bearer header rather than the cookie jar: supertest does not persist
 * cookies between requests, and threading them through by hand would obscure
 * what each test is actually checking.
 */
export async function makeUser(
  overrides: { email?: string; role?: "user" | "admin"; password?: string } = {}
): Promise<TestUser> {
  const email = overrides.email ?? `user${Date.now()}${Math.random()}@test.dev`;
  const password = overrides.password ?? "Passw0rdTest";

  const user = await User.create({
    name: "Test User",
    email,
    passwordHash: await hashPassword(password),
    role: overrides.role ?? "user",
  });

  const response = await request(app())
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);

  return {
    id: user.id,
    email,
    password,
    auth: `Bearer ${response.body.access}`,
  };
}

/** A date string N days from now, in the YYYY-MM-DD form the API expects. */
export function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
