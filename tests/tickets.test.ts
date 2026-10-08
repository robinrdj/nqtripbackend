import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, daysFromNow, makeAdventure, makeCity, makeUser, type TestUser } from "./helpers.js";
import { User } from "../src/models/User.js";
import { sentMail, settleMail } from "../src/services/mailer.js";
import { ticketSignature } from "../src/services/ticketService.js";

/** Collects a binary response body; supertest only buffers text by default. */
function binary(res: NodeJS.ReadableStream, done: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => done(null, Buffer.concat(chunks)));
}

async function book(user: TestUser, overrides: Record<string, unknown> = {}) {
  const response = await request(app())
    .post("/api/v1/reservations")
    .set("Authorization", user.auth)
    .send({
      adventure: "adv-1",
      name: "Robin Rajadurai",
      date: daysFromNow(5),
      persons: 2,
      ...overrides,
    })
    .expect(201);
  return response.body.reservation as { id: string };
}

describe("booking emails", () => {
  it("emails a confirmation with the ticket attached", async () => {
    await makeCity();
    await makeAdventure();
    const user = await makeUser({ email: "robin@test.dev" });

    await book(user);
    await settleMail();

    expect(sentMail).toHaveLength(1);
    const mail = sentMail[0]!;
    expect(mail.to).toBe("robin@test.dev");
    expect(mail.subject).toMatch(/^You're booked: Sunset Kayaking/);
    expect(mail.html).toContain("Goa");
    expect(mail.text).toContain("Guests: 2 people");

    const attachment = mail.attachments?.[0];
    expect(attachment?.contentType).toBe("application/pdf");
    expect(attachment?.content.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("escapes the customer's name in the HTML", async () => {
    await makeAdventure();
    const user = await makeUser();
    await User.updateOne({ email: user.email }, { name: "<script>x</script>" });

    await book(user);
    await settleMail();

    expect(sentMail[0]!.html).not.toContain("<script>x</script>");
    expect(sentMail[0]!.html).toContain("&lt;script&gt;");
  });

  it("emails again when the booking is cancelled", async () => {
    await makeAdventure();
    const user = await makeUser();
    const reservation = await book(user);

    await request(app())
      .post(`/api/v1/reservations/${reservation.id}/cancel`)
      .set("Authorization", user.auth)
      .expect(200);
    await settleMail();

    expect(sentMail.map((m) => m.subject)).toEqual([
      expect.stringMatching(/^You're booked/),
      expect.stringMatching(/^Cancelled: Sunset Kayaking/),
    ]);
  });

  it("sends nothing for a legacy booking, which has no owner to email", async () => {
    await makeAdventure();

    await request(app())
      .post("/reservations/new")
      .send({ name: "Legacy", date: daysFromNow(5), person: "1", adventure: "adv-1" })
      .expect(200);
    await settleMail();

    expect(sentMail).toHaveLength(0);
  });
});

describe("GET /api/v1/reservations/:id/ticket", () => {
  it("returns the owner's ticket as a PDF download", async () => {
    await makeAdventure();
    const user = await makeUser();
    const reservation = await book(user);

    const response = await request(app())
      .get(`/api/v1/reservations/${reservation.id}/ticket`)
      .set("Authorization", user.auth)
      .buffer(true)
      .parse(binary)
      .expect(200);

    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toMatch(
      /^attachment; filename="qtrip-ticket-QT-[0-9A-F]{8}\.pdf"$/
    );
    expect((response.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("refuses someone else's booking", async () => {
    await makeAdventure();
    const owner = await makeUser();
    const stranger = await makeUser();
    const reservation = await book(owner);

    await request(app())
      .get(`/api/v1/reservations/${reservation.id}/ticket`)
      .set("Authorization", stranger.auth)
      .expect(403);
  });

  it("has no ticket for a cancelled booking", async () => {
    await makeAdventure();
    const user = await makeUser();
    const reservation = await book(user);

    await request(app())
      .post(`/api/v1/reservations/${reservation.id}/cancel`)
      .set("Authorization", user.auth)
      .expect(200);

    await request(app())
      .get(`/api/v1/reservations/${reservation.id}/ticket`)
      .set("Authorization", user.auth)
      .expect(409);
  });

  it("requires a session", async () => {
    await request(app())
      .get("/api/v1/reservations/64b000000000000000000000/ticket")
      .expect(401);
  });

  it("answers 404, not 500, for a malformed id", async () => {
    const user = await makeUser();
    await request(app())
      .get("/api/v1/reservations/not-an-id/ticket")
      .set("Authorization", user.auth)
      .expect(404);
  });
});

describe("GET /api/v1/tickets/:id/verify", () => {
  it("confirms a genuine ticket without revealing the full name", async () => {
    await makeAdventure();
    const user = await makeUser();
    const reservation = await book(user, { name: "Robin Rajadurai" });

    const response = await request(app())
      .get(`/api/v1/tickets/${reservation.id}/verify`)
      .query({ sig: ticketSignature(reservation.id) })
      .expect(200);

    expect(response.body).toEqual({
      valid: true,
      reference: expect.stringMatching(/^QT-[0-9A-F]{8}$/),
      status: "confirmed",
      adventureName: "Sunset Kayaking",
      city: "goa",
      date: daysFromNow(5),
      persons: 2,
      guest: "Robin R.",
    });
  });

  it("reports a cancelled booking as cancelled", async () => {
    await makeAdventure();
    const user = await makeUser();
    const reservation = await book(user);
    await request(app())
      .post(`/api/v1/reservations/${reservation.id}/cancel`)
      .set("Authorization", user.auth)
      .expect(200);

    const response = await request(app())
      .get(`/api/v1/tickets/${reservation.id}/verify`)
      .query({ sig: ticketSignature(reservation.id) })
      .expect(200);

    expect(response.body).toMatchObject({ valid: true, status: "cancelled" });
  });

  it("rejects a forged signature the same way as an unknown id", async () => {
    await makeAdventure();
    const user = await makeUser();
    const reservation = await book(user);

    const forged = await request(app())
      .get(`/api/v1/tickets/${reservation.id}/verify`)
      .query({ sig: "A".repeat(22) })
      .expect(200);

    const unknownId = "64b000000000000000000000";
    const unknown = await request(app())
      .get(`/api/v1/tickets/${unknownId}/verify`)
      .query({ sig: ticketSignature(unknownId) })
      .expect(200);

    const missing = await request(app())
      .get(`/api/v1/tickets/${reservation.id}/verify`)
      .expect(200);

    expect(forged.body).toEqual({ valid: false });
    expect(unknown.body).toEqual({ valid: false });
    expect(missing.body).toEqual({ valid: false });
  });
});
