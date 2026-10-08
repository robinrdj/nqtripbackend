import { createHmac, timingSafeEqual } from "node:crypto";
import { Types } from "mongoose";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { env } from "../config/env.js";
import { City } from "../models/City.js";
import { Reservation } from "../models/Reservation.js";
import { AppError } from "../utils/AppError.js";

/**
 * Tickets: a PDF with a QR code that anyone can scan to check a booking.
 *
 * The QR carries a URL with an HMAC signature of the reservation id. The id
 * alone would be enough to look a booking up, but ids are not secrets — they
 * appear in URLs and logs — so without the signature anyone could enumerate
 * them and read other people's bookings through the verify page.
 */

const signingKey: Buffer = env.TICKET_SECRET
  ? Buffer.from(env.TICKET_SECRET)
  : // Derived, not reused: the JWT secret itself never signs anything but JWTs.
    createHmac("sha256", env.JWT_ACCESS_SECRET).update("qtrip:ticket-key:v1").digest();

export function ticketSignature(reservationId: string): string {
  return createHmac("sha256", signingKey)
    .update(`ticket:v1:${reservationId}`)
    .digest("base64url")
    .slice(0, 22); // 132 bits: unguessable, and keeps the QR code small.
}

export function ticketVerifyUrl(reservationId: string): string {
  return `${env.PUBLIC_APP_URL}/tickets/${reservationId}?sig=${ticketSignature(reservationId)}`;
}

/** Short, readable reference printed on the ticket and quoted in emails. */
export function bookingReference(reservationId: string): string {
  return `QT-${reservationId.slice(-8).toUpperCase()}`;
}

function signatureMatches(reservationId: string, sig: string): boolean {
  const expected = Buffer.from(ticketSignature(reservationId));
  const given = Buffer.from(sig);
  // Length check first: timingSafeEqual throws on unequal lengths.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** "Robin Rajadurai" -> "Robin R." — enough to match a face, not a full name. */
function maskName(name: string): string {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0)}.` : first;
}

export type TicketCheck =
  | {
      valid: true;
      reference: string;
      status: "confirmed" | "cancelled";
      adventureName: string;
      city?: string;
      date: string;
      persons: number;
      guest: string;
    }
  | { valid: false };

/**
 * Public: answers "is this ticket genuine?" for whoever scans it.
 *
 * A bad signature and an unknown id get the same answer, so the endpoint does
 * not confirm which ids exist. A cancelled booking is still reported as a
 * genuine ticket, with its status, so the person at the door knows why it
 * should be turned away.
 */
export async function verifyTicket(reservationId: string, sig: string): Promise<TicketCheck> {
  if (!Types.ObjectId.isValid(reservationId) || !signatureMatches(reservationId, sig)) {
    return { valid: false };
  }

  const reservation = await Reservation.findById(reservationId).lean();
  if (!reservation) return { valid: false };

  return {
    valid: true,
    reference: bookingReference(reservationId),
    status: reservation.status as "confirmed" | "cancelled",
    adventureName: reservation.adventureName,
    ...(reservation.city ? { city: reservation.city } : {}),
    date: reservation.date.toISOString().slice(0, 10),
    persons: reservation.persons,
    guest: maskName(reservation.name),
  };
}

/* -------------------------------------------------------------------------- */
/* PDF                                                                         */
/* -------------------------------------------------------------------------- */

// The web app's brand-600 and brand-50, so the ticket matches the site.
const BRAND = "#e65000";
const BRAND_TINT = "#fff2e8";
const INK = "#111827";
const MUTED = "#6b7280";

/**
 * Formatted by hand rather than with Intl's currency style: the PDF's built-in
 * Helvetica has no rupee glyph, so "₹" would render as a blank box.
 */
function formatMoney(amount: number, currency = "INR"): string {
  return `${currency} ${new Intl.NumberFormat("en-IN").format(amount)}`;
}

/** Calendar day in UTC — see the note on how reservation dates are stored. */
function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export interface TicketData {
  id: string;
  adventureName: string;
  cityName?: string;
  date: Date;
  persons: number;
  name: string;
  price: number;
}

export async function renderTicketPdf(ticket: TicketData): Promise<Buffer> {
  const qr = await QRCode.toBuffer(ticketVerifyUrl(ticket.id), {
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
  });

  const doc = new PDFDocument({
    size: "A5",
    layout: "landscape",
    margin: 0,
    info: {
      Title: `QTrip ticket ${bookingReference(ticket.id)}`,
      Author: "QTrip",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const width = doc.page.width;
  const height = doc.page.height;

  // Header band.
  doc.rect(0, 0, width, 70).fill(BRAND);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(22).text("QTrip", 32, 22);
  doc
    .font("Helvetica")
    .fontSize(10)
    .text("ADVENTURE TICKET", 0, 30, { width: width - 32, align: "right" });

  // Left column: the booking.
  const left = 32;
  let y = 100;

  doc.fillColor(MUTED).fontSize(9).text("ADVENTURE", left, y);
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(ticket.adventureName, left, y + 12, { width: 330 });
  y = doc.y + 4;

  if (ticket.cityName) {
    doc.font("Helvetica").fontSize(11).fillColor(MUTED).text(ticket.cityName, left, y);
    y = doc.y;
  }

  const field = (label: string, value: string, x: number, top: number) => {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(label, x, top);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(value, x, top + 12, {
      width: 170,
    });
  };

  y += 22;
  field("DATE", formatDay(ticket.date), left, y);
  field("GUESTS", `${ticket.persons} ${ticket.persons === 1 ? "person" : "people"}`, left + 190, y);
  y += 50;
  field("LEAD GUEST", ticket.name, left, y);
  field("TOTAL PAID", formatMoney(ticket.price), left + 190, y);
  y += 50;
  field("BOOKING REFERENCE", bookingReference(ticket.id), left, y);

  // Right column: the QR code on a tinted panel.
  const panelX = width - 210;
  doc.rect(panelX, 70, 210, height - 70).fill(BRAND_TINT);
  doc.image(qr, panelX + 30, 110, { width: 150 });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text("Show this code at the meeting point", panelX + 15, 272, {
      width: 180,
      align: "center",
    });

  // Footer.
  doc
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      "Scan the code to check this ticket  ·  Free cancellation from My Trips before the day",
      left,
      height - 30,
      { width: panelX - left - 16 }
    );

  doc.end();
  return finished;
}

/** The ticket for one of the signed-in user's own confirmed bookings. */
export async function ticketForUser(
  reservationId: string,
  userId: string
): Promise<{ filename: string; pdf: Buffer }> {
  if (!Types.ObjectId.isValid(reservationId)) {
    throw AppError.notFound("We could not find that booking.");
  }

  const reservation = await Reservation.findById(reservationId).lean();
  if (!reservation) throw AppError.notFound("We could not find that booking.");

  // Same rule as cancelling: someone else's booking is not yours to print.
  if (!reservation.user || reservation.user.toString() !== userId) {
    throw AppError.forbidden("That booking belongs to someone else.");
  }

  if (reservation.status === "cancelled") {
    throw AppError.conflict("That booking was cancelled, so it has no ticket.");
  }

  const pdf = await renderTicketPdf(await toTicketData(reservationId, reservation));
  return { filename: ticketFilename(reservationId), pdf };
}

export function ticketFilename(reservationId: string): string {
  return `qtrip-ticket-${bookingReference(reservationId)}.pdf`;
}

/** Resolves the display city name alongside the reservation's own fields. */
export async function toTicketData(
  reservationId: string,
  reservation: {
    adventureName: string;
    city?: string | null;
    date: Date;
    persons: number;
    name: string;
    price: number;
  }
): Promise<TicketData> {
  const city = reservation.city
    ? await City.findById(reservation.city, { city: 1 }).lean()
    : null;

  return {
    id: reservationId,
    adventureName: reservation.adventureName,
    ...(city ? { cityName: city.city } : {}),
    date: reservation.date,
    persons: reservation.persons,
    name: reservation.name,
    price: reservation.price,
  };
}
