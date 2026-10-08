import { beforeEach, describe, expect, it, vi } from "vitest";

// Must exist before config/env is first imported, and imports are hoisted
// above ordinary statements - vi.hoisted runs ahead of them.
vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
});

// Google itself is stood in for: the test is of what we do with a verified
// identity, not of Google's signature checks.
vi.mock("../src/utils/googleIdentity.js", () => ({
  verifyGoogleCredential: vi.fn(),
}));

import request from "supertest";
import { app, makeUser } from "./helpers.js";
import { User } from "../src/models/User.js";
import { verifyGoogleCredential } from "../src/utils/googleIdentity.js";

const verify = vi.mocked(verifyGoogleCredential);

function googleSays(profile: Partial<Awaited<ReturnType<typeof verifyGoogleCredential>>> = {}) {
  verify.mockResolvedValue({
    sub: "google-123",
    email: "traveller@gmail.com",
    emailVerified: true,
    name: "Google Traveller",
    picture: "https://lh3.googleusercontent.com/a/photo",
    ...profile,
  });
}

beforeEach(() => {
  verify.mockReset();
});

describe("GET /api/v1/auth/providers", () => {
  it("advertises Google with its public client id", async () => {
    const response = await request(app()).get("/api/v1/auth/providers").expect(200);
    expect(response.body).toEqual({
      password: true,
      google: { enabled: true, clientId: "test-client.apps.googleusercontent.com" },
    });
  });
});

describe("POST /api/v1/auth/google", () => {
  it("creates an account on first sign-in and sets the session cookies", async () => {
    googleSays();

    const response = await request(app())
      .post("/api/v1/auth/google")
      .send({ credential: "id-token" })
      .expect(200);

    expect(response.body.user).toMatchObject({
      name: "Google Traveller",
      email: "traveller@gmail.com",
      avatarUrl: "https://lh3.googleusercontent.com/a/photo",
    });
    // Internal linkage never reaches the client.
    expect(response.body.user.googleId).toBeUndefined();
    expect(String(response.headers["set-cookie"])).toMatch(/qtrip_access=/);

    const stored = await User.findOne({ email: "traveller@gmail.com" }).select("+passwordHash");
    expect(stored?.googleId).toBe("google-123");
    expect(stored?.passwordHash).toBeUndefined();
  });

  it("signs the same person back in rather than creating a duplicate", async () => {
    googleSays();
    await request(app()).post("/api/v1/auth/google").send({ credential: "a" }).expect(200);
    // Their Google address changed; the stable `sub` still finds them.
    googleSays({ email: "renamed@gmail.com" });
    await request(app()).post("/api/v1/auth/google").send({ credential: "b" }).expect(200);

    expect(await User.countDocuments()).toBe(1);
  });

  it("links to an existing password account with the same verified email", async () => {
    const existing = await makeUser({ email: "traveller@gmail.com" });
    googleSays();

    const response = await request(app())
      .post("/api/v1/auth/google")
      .send({ credential: "id-token" })
      .expect(200);

    expect(response.body.user.id).toBe(existing.id);
    // The password still works too.
    await request(app())
      .post("/api/v1/auth/login")
      .send({ email: existing.email, password: existing.password })
      .expect(200);
  });

  it("refuses an unverified Google email, which could be someone else's", async () => {
    await makeUser({ email: "traveller@gmail.com" });
    googleSays({ emailVerified: false });

    await request(app())
      .post("/api/v1/auth/google")
      .send({ credential: "id-token" })
      .expect(401);

    const user = await User.findOne({ email: "traveller@gmail.com" });
    expect(user?.googleId).toBeUndefined();
  });

  it("answers 401 when Google rejects the token", async () => {
    verify.mockRejectedValue(new Error("Wrong recipient, payload audience != requiredAudience"));

    const response = await request(app())
      .post("/api/v1/auth/google")
      .send({ credential: "forged" })
      .expect(401);

    // Google's internal error text is not passed on.
    expect(response.body.error.message).not.toMatch(/audience/);
  });

  it("validates the body", async () => {
    await request(app()).post("/api/v1/auth/google").send({}).expect(400);
  });
});

describe("Google-only accounts and passwords", () => {
  beforeEach(async () => {
    googleSays();
    await request(app()).post("/api/v1/auth/google").send({ credential: "t" }).expect(200);
  });

  it("cannot be signed into with a password, and says nothing more", async () => {
    const response = await request(app())
      .post("/api/v1/auth/login")
      .send({ email: "traveller@gmail.com", password: "Anything1" })
      .expect(401);

    expect(response.body.error.message).toBe("That email or password is not right.");
  });

  it("explains why there is no password to change", async () => {
    const signIn = await request(app())
      .post("/api/v1/auth/google")
      .send({ credential: "t" })
      .expect(200);

    const response = await request(app())
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${signIn.body.access}`)
      .send({ currentPassword: "x", newPassword: "NewPassw0rd" })
      .expect(400);

    expect(response.body.error.message).toMatch(/signs in with Google/);
  });
});
