import { describe, expect, it, vi } from "vitest";

// Runs this file as production, with the e2e escape hatch switched on - the
// combination that must still rate-limit. Set before config/env is imported.
vi.hoisted(() => {
  process.env.NODE_ENV = "production";
  process.env.DISABLE_RATE_LIMIT = "true";
});

import request from "supertest";
import { app } from "./helpers.js";

describe("DISABLE_RATE_LIMIT in production", () => {
  it("is ignored: the sign-in limit still applies", async () => {
    const attempt = () =>
      request(app())
        .post("/api/v1/auth/login")
        .send({ email: "nobody@test.dev", password: "Wrong1234" });

    // The auth limiter allows 20 attempts per window.
    for (let i = 0; i < 20; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
    expect((await attempt()).status).toBe(429);
  });
});
