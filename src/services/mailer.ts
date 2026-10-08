import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { env, isProduction, isTest } from "../config/env.js";

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

/**
 * Where mail goes depends on configuration, never on code paths:
 *
 * - SMTP_URL set      -> sent for real, through whatever provider it names.
 * - under test        -> kept in memory, so tests can assert on what was sent.
 * - development       -> written to .mail-outbox/ as .eml files, which open in
 *                        any mail client with the PDF attached. No account needed.
 * - production, unset -> skipped with a log line; bookings still succeed.
 */
type Mode = "smtp" | "memory" | "outbox" | "disabled";

const mode: Mode = env.SMTP_URL
  ? "smtp"
  : isTest
    ? "memory"
    : isProduction
      ? "disabled"
      : "outbox";

const OUTBOX_DIR = path.resolve(".mail-outbox");

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??=
    mode === "smtp"
      ? nodemailer.createTransport(env.SMTP_URL)
      : // Renders the full RFC 822 message into a buffer instead of sending it.
        nodemailer.createTransport({ streamTransport: true, buffer: true });
  return transporter;
}

/** What was "sent" under test, oldest first. */
export const sentMail: OutgoingMail[] = [];

export function clearSentMail(): void {
  sentMail.length = 0;
}

export async function sendMail(mail: OutgoingMail): Promise<void> {
  if (mode === "memory") {
    sentMail.push(mail);
    return;
  }

  if (mode === "disabled") {
    console.warn(`[mail] SMTP_URL is not set; not sending "${mail.subject}"`);
    return;
  }

  const info = await getTransporter().sendMail({ from: env.MAIL_FROM, ...mail });

  if (mode === "outbox") {
    await mkdir(OUTBOX_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = mail.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const file = path.join(OUTBOX_DIR, `${stamp}-${slug}.eml`);
    await writeFile(file, info.message as Buffer);
    console.log(`[mail] to ${mail.to}: "${mail.subject}" -> ${file}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Background delivery                                                         */
/* -------------------------------------------------------------------------- */

const pending = new Set<Promise<void>>();
const lanes = new Map<string, Promise<void>>();

/**
 * Runs a mail job after the response has been sent.
 *
 * A booking is complete once its row is written; the email is a notification
 * about it. So a slow or unreachable SMTP server must neither delay the
 * customer's response nor turn a successful booking into an error — failures
 * are logged and dropped.
 *
 * Jobs sharing a `lane` (one booking) run in order. Without that, booking and
 * then promptly cancelling could deliver "Cancelled" before "You're booked",
 * because the confirmation renders a PDF and the cancellation does not.
 * Different bookings still send in parallel.
 */
export function deliverInBackground(lane: string, job: () => Promise<void>): void {
  const previous = lanes.get(lane) ?? Promise.resolve();

  const task = previous.then(async () => {
    try {
      await job();
    } catch (err) {
      console.error("[mail] delivery failed:", err);
    }
  });

  lanes.set(lane, task);
  pending.add(task);
  void task.finally(() => {
    pending.delete(task);
    // Only clear the lane if nothing queued behind this job.
    if (lanes.get(lane) === task) lanes.delete(lane);
  });
}

/** Resolves once every queued job has finished. Used by tests and shutdown. */
export async function settleMail(): Promise<void> {
  while (pending.size > 0) {
    await Promise.all([...pending]);
  }
}
