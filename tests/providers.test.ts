import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers.js";

// The default configuration: no GOOGLE_CLIENT_ID. The enabled case lives in
// googleAuth.test.ts, which sets one before the app loads.
describe("sign-in providers when Google is not configured", () => {
  it("offers passwords only", async () => {
    const response = await request(app()).get("/api/v1/auth/providers").expect(200);
    expect(response.body).toEqual({ password: true, google: { enabled: false } });
  });

  it("turns the Google endpoint away without calling Google", async () => {
    const response = await request(app())
      .post("/api/v1/auth/google")
      .send({ credential: "anything" })
      .expect(404);
    expect(response.body.error.code).toBe("NOT_ENABLED");
  });
});
