/**
 * The live stream is exercised over a real socket: supertest buffers the whole
 * response before resolving, and an event stream never ends.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, daysFromNow, makeAdventure, makeUser } from "./helpers.js";
import { viewerCount } from "../src/services/liveEvents.js";

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

let server: http.Server;
let baseUrl: string;
const openRequests: http.ClientRequest[] = [];

beforeEach(async () => {
  server = app().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const req of openRequests.splice(0)) req.destroy();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Opens a stream and returns a function that waits for the next event. */
function openStream(path: string): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  next: (event?: string) => Promise<SseEvent>;
}> {
  return new Promise((resolve, reject) => {
    const req = http.get(`${baseUrl}${path}`, (res) => {
      const queue: SseEvent[] = [];
      const waiters: (() => void)[] = [];
      let buffer = "";

      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        buffer += chunk;
        let split: number;
        while ((split = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const event = /^event: (.+)$/m.exec(block)?.[1];
          const data = /^data: (.+)$/m.exec(block)?.[1];
          if (event && data) {
            queue.push({ event, data: JSON.parse(data) });
            waiters.splice(0).forEach((wake) => wake());
          }
        }
      });

      const next = async (event?: string): Promise<SseEvent> => {
        for (;;) {
          const index = queue.findIndex((e) => !event || e.event === event);
          if (index !== -1) return queue.splice(index, 1)[0]!;
          await new Promise<void>((wake) => waiters.push(wake));
        }
      };

      resolve({ status: res.statusCode ?? 0, headers: res.headers, next });
    });
    req.on("error", reject);
    openRequests.push(req);
  });
}

describe("GET /api/v1/adventures/:id/live", () => {
  it("opens an event stream with the current seat count", async () => {
    await makeAdventure({ capacity: 10, booked: 3 });

    const stream = await openStream("/api/v1/adventures/adv-1/live");

    expect(stream.status).toBe(200);
    expect(stream.headers["content-type"]).toMatch(/^text\/event-stream/);
    expect((await stream.next("seats")).data).toEqual({
      adventureId: "adv-1",
      capacity: 10,
      booked: 3,
      seatsLeft: 7,
    });
  });

  it("pushes the new count when someone books", async () => {
    await makeAdventure({ capacity: 10, booked: 0 });
    const user = await makeUser();
    const stream = await openStream("/api/v1/adventures/adv-1/live");
    await stream.next("seats");

    await request(app())
      .post("/api/v1/reservations")
      .set("Authorization", user.auth)
      .send({ adventure: "adv-1", name: "Robin", date: daysFromNow(3), persons: 4 })
      .expect(201);

    expect((await stream.next("seats")).data).toMatchObject({ booked: 4, seatsLeft: 6 });
  });

  it("counts viewers up and back down", async () => {
    await makeAdventure();

    const first = await openStream("/api/v1/adventures/adv-1/live");
    expect((await first.next("viewers")).data).toMatchObject({ count: 1 });

    await openStream("/api/v1/adventures/adv-1/live");
    expect((await first.next("viewers")).data).toMatchObject({ count: 2 });

    // Closing the second tab is seen by the first.
    openRequests.pop()!.destroy();
    expect((await first.next("viewers")).data).toMatchObject({ count: 1 });
  });

  it("answers a normal 404 for an unknown adventure", async () => {
    const response = await request(app()).get("/api/v1/adventures/nope/live").expect(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(viewerCount("nope")).toBe(0);
  });
});
