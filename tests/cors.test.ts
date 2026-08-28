/**
 * CORS behaviour.
 *
 * The allowlist is set from CORS_ORIGINS in tests/setup.ts, which pins it to
 * http://localhost:8081.
 */
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, makeCity } from "./helpers.js";

describe("allowed origins", () => {
  it("echoes the origin back so a credentialed request can succeed", async () => {
    await makeCity();

    const response = await request(app())
      .get("/api/v1/cities")
      .set("Origin", "http://localhost:8081")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:8081"
    );
    // Cookies only travel when this is present.
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("serves a request with no Origin at all", async () => {
    // curl, server-to-server, and health checks send no Origin.
    await request(app()).get("/health").expect(200);
  });
});

describe("origins that are not allowed", () => {
  it("still serves the request, just without CORS headers", async () => {
    await makeCity();

    /*
      Regression: this used to pass an Error to the cors callback, which the
      error handler reported as a 500 "Something went wrong on our end."

      It broke the deployed app, because a frontend that proxies /api through
      its own domain is same-origin to the browser but still forwards the
      original Origin header — so every proxied request 500ed.
    */
    const response = await request(app())
      .get("/api/v1/cities")
      .set("Origin", "https://not-on-the-allowlist.example")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("does not turn a disallowed origin into a server error", async () => {
    const response = await request(app())
      .post("/api/v1/auth/login")
      .set("Origin", "https://not-on-the-allowlist.example")
      .send({ email: "nobody@example.com", password: "whatever" });

    // 401 for the bad credentials — not 500 for the origin.
    expect(response.status).toBe(401);
    expect(response.body.error.code).not.toBe("INTERNAL_ERROR");
  });

  it("lets a real sign-in through from a proxied origin", async () => {
    const { makeUser } = await import("./helpers.js");
    const user = await makeUser({ email: "proxied@test.dev" });

    await request(app())
      .post("/api/v1/auth/login")
      .set("Origin", "https://some-frontend.netlify.app")
      .send({ email: user.email, password: user.password })
      .expect(200);
  });
});
