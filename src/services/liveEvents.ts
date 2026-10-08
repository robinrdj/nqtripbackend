import { EventEmitter } from "node:events";
import { Adventure } from "../models/Adventure.js";

/**
 * Pushes seat availability and "people viewing" counts to open detail pages.
 *
 * The hub is in-process: a booking made on this instance reaches the viewers
 * connected to this instance. That is exactly right for a single server (the
 * Render deploy is one instance). Scaling out would mean swapping the emitter
 * for Redis pub/sub or a MongoDB change stream, and nothing outside this file
 * would need to change.
 */

export interface SeatUpdate {
  adventureId: string;
  seatsLeft: number;
  capacity: number;
  booked: number;
}

export type LiveEvent =
  | { type: "seats"; data: SeatUpdate }
  | { type: "viewers"; data: { adventureId: string; count: number } };

const bus = new EventEmitter();
// One listener per open page, so the default warning at 10 is meaningless here.
bus.setMaxListeners(0);

const viewers = new Map<string, number>();
let openStreams = 0;

/**
 * A ceiling on concurrent streams, so a flood of connections cannot exhaust
 * sockets and memory. Far above what the demo will see.
 */
export const MAX_OPEN_STREAMS = 1000;

export function canOpenStream(): boolean {
  return openStreams < MAX_OPEN_STREAMS;
}

export function viewerCount(adventureId: string): number {
  return viewers.get(adventureId) ?? 0;
}

function emit(adventureId: string, event: LiveEvent): void {
  bus.emit(adventureId, event);
}

function broadcastViewers(adventureId: string): void {
  emit(adventureId, {
    type: "viewers",
    data: { adventureId, count: viewerCount(adventureId) },
  });
}

/**
 * Registers a viewer and returns the function that removes them. Everyone
 * already watching is told the new count, and so is the newcomer.
 */
export function subscribe(
  adventureId: string,
  listener: (event: LiveEvent) => void
): () => void {
  bus.on(adventureId, listener);
  viewers.set(adventureId, viewerCount(adventureId) + 1);
  openStreams += 1;
  broadcastViewers(adventureId);

  let active = true;
  return () => {
    // Guards against a double call (both `close` and an error firing), which
    // would otherwise drive the count negative.
    if (!active) return;
    active = false;

    bus.off(adventureId, listener);
    openStreams -= 1;
    const next = viewerCount(adventureId) - 1;
    if (next > 0) viewers.set(adventureId, next);
    else viewers.delete(adventureId);
    broadcastViewers(adventureId);
  };
}

/** The adventure's current counts, or null if there is no such adventure. */
export async function seatSnapshot(adventureId: string): Promise<SeatUpdate | null> {
  const doc = await Adventure.findById(adventureId, { capacity: 1, booked: 1 }).lean();
  if (!doc) return null;

  return {
    adventureId,
    capacity: doc.capacity,
    booked: doc.booked,
    seatsLeft: Math.max(0, doc.capacity - doc.booked),
  };
}

/**
 * Reads the adventure's current counts and pushes them to its viewers.
 *
 * Re-reading rather than trusting the caller's numbers means an update always
 * reports the stored truth, even if two bookings land in the same instant.
 * Never throws: a live update is a nicety and must not fail the booking that
 * triggered it.
 */
export async function publishSeats(adventureId: string): Promise<void> {
  try {
    const snapshot = await seatSnapshot(adventureId);
    if (snapshot) emit(adventureId, { type: "seats", data: snapshot });
  } catch (err) {
    console.warn("[live] could not publish seats:", (err as Error).message);
  }
}

/* -------------------------------------------------------------------------- */
/* Shutdown                                                                    */
/* -------------------------------------------------------------------------- */

const closers = new Set<() => void>();

/**
 * Registers a way to end an open stream. `server.close()` waits for every
 * connection to finish, and a live stream never does on its own - so without
 * this a deploy's graceful shutdown would stall until it was killed.
 */
export function trackStream(end: () => void): () => void {
  closers.add(end);
  return () => closers.delete(end);
}

export function endAllStreams(): void {
  for (const end of [...closers]) end();
  closers.clear();
}
