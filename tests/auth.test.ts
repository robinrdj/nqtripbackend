import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, makeUser } from "./helpers.js";
import { User } from "../src/models/User.js";

describe("POST /api/v1/auth/register", () => {
  it("creates an account and returns tokens", async () => {
    const response = await request(app())
      .post("/api/v1/auth/register")
      .send({ name: "Robin", email: "Robin@Example.com", password: "Passw0rd!" })
      .expect(201);

    expect(response.body.user).toMatchObject({
      name: "Robin",
      // Stored lowercased, so "Robin@" and "robin@" are one account.
      email: "robin@example.com",
      role: "user",
    });
    expect(response.body.access).toBeTypeOf("string");
    expect(response.body.refresh).toBeTypeOf("string");
  });

  it("never returns the password hash", async () => {
    const response = await request(app())
      .post("/api/v1/auth/register")
      .send({ name: "Robin", email: "hash@example.com", password: "Passw0rd!" })
      .expect(201);

    expect(response.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("$2");
  });

  it("sets httpOnly auth cookies", async () => {
    const response = await request(app())
      .post("/api/v1/auth/register")
      .send({ name: "Robin", email: "cookie@example.com", password: "Passw0rd!" })
      .expect(201);

    const cookies = response.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("qtrip_access=") && c.includes("HttpOnly"))).toBe(true);
    expect(cookies.some((c) => c.startsWith("qtrip_refresh=") && c.includes("HttpOnly"))).toBe(true);
  });

  it("rejects a weak password with a per-field message", async () => {
    const response = await request(app())
      .post("/api/v1/auth/register")
      .send({ name: "Robin", email: "weak@example.com", password: "short" })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ field: "password" })
    );
  });

  it("refuses a duplicate email", async () => {
    await request(app())
      .post("/api/v1/auth/register")
      .send({ name: "Robin", email: "dupe@example.com", password: "Passw0rd!" })
      .expect(201);

    const response = await request(app())
      .post("/api/v1/auth/register")
      .send({ name: "Someone", email: "dupe@example.com", password: "Passw0rd!" })
      .expect(409);

    expect(response.body.error.message).toMatch(/already exists/i);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("signs in with the right password", async () => {
    const user = await makeUser({ email: "login@example.com" });

    const response = await request(app())
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(200);

    expect(response.body.user.email).toBe("login@example.com");
  });

  it("gives the same answer for a wrong password and an unknown account", async () => {
    const user = await makeUser({ email: "known@example.com" });

    const wrongPassword = await request(app())
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "NotTheP4ssword" })
      .expect(401);

    const unknownAccount = await request(app())
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "NotTheP4ssword" })
      .expect(401);

    // Differing responses would let an attacker enumerate registered emails.
    expect(wrongPassword.body.error.message).toBe(
      unknownAccount.body.error.message
    );
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns the signed-in user", async () => {
    const user = await makeUser({ email: "me@example.com" });

    const response = await request(app())
      .get("/api/v1/auth/me")
      .set("Authorization", user.auth)
      .expect(200);

    expect(response.body.user.email).toBe("me@example.com");
  });

  it("rejects an anonymous request", async () => {
    await request(app()).get("/api/v1/auth/me").expect(401);
  });

  it("rejects a tampered token", async () => {
    const user = await makeUser();
    await request(app())
      .get("/api/v1/auth/me")
      .set("Authorization", `${user.auth}tampered`)
      .expect(401);
  });
});

describe("POST /api/v1/auth/change-password", () => {
  it("invalidates refresh tokens issued before the change", async () => {
    const user = await makeUser({ email: "rotate@example.com" });

    const before = await User.findById(user.id);
    expect(before?.tokenVersion).toBe(0);

    await request(app())
      .post("/api/v1/auth/change-password")
      .set("Authorization", user.auth)
      .send({ currentPassword: user.password, newPassword: "N3wPassword!" })
      .expect(200);

    const after = await User.findById(user.id);
    expect(after?.tokenVersion).toBe(1);
  });

  it("refuses when the current password is wrong", async () => {
    const user = await makeUser();

    await request(app())
      .post("/api/v1/auth/change-password")
      .set("Authorization", user.auth)
      .send({ currentPassword: "WrongP4ssword", newPassword: "N3wPassword!" })
      .expect(400);
  });
});
