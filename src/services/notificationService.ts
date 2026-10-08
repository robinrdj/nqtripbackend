import { env } from "../config/env.js";
import {
  bookingCancelledEmail,
  bookingConfirmedEmail,
  type BookingEmailData,
} from "../emails/templates.js";
import { Reservation } from "../models/Reservation.js";
import { User } from "../models/User.js";
import { deliverInBackground, sendMail } from "./mailer.js";
import {
  bookingReference,
  renderTicketPdf,
  ticketFilename,
  toTicketData,
  type TicketData,
} from "./ticketService.js";

/**
 * Booking lifecycle emails. Both are queued, not awaited: see
 * `deliverInBackground` for why a notification can never fail a booking.
 */

function toEmailData(ticket: TicketData, customerName: string): BookingEmailData {
  return {
    customerName,
    adventureName: ticket.adventureName,
    ...(ticket.cityName ? { cityName: ticket.cityName } : {}),
    dateLabel: new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      // Reservation dates are stored as UTC midnight of the booked day.
      timeZone: "UTC",
    }).format(ticket.date),
    persons: ticket.persons,
    totalLabel: new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(ticket.price),
    reference: bookingReference(ticket.id),
    tripsUrl: `${env.PUBLIC_APP_URL}/trips`,
  };
}

/**
 * Loads what an email needs. Returns null for bookings nobody can be emailed
 * about — the unowned legacy rows, or an account deleted in the meantime.
 */
async function load(reservationId: string) {
  const reservation = await Reservation.findById(reservationId).lean();
  if (!reservation?.user) return null;

  const user = await User.findById(reservation.user, { email: 1, name: 1 }).lean();
  if (!user) return null;

  const ticket = await toTicketData(reservationId, reservation);
  return { user, ticket };
}

export function queueBookingConfirmation(reservationId: string): void {
  deliverInBackground(reservationId, async () => {
    const loaded = await load(reservationId);
    if (!loaded) return;

    const email = bookingConfirmedEmail(toEmailData(loaded.ticket, loaded.user.name));
    await sendMail({
      to: loaded.user.email,
      ...email,
      attachments: [
        {
          filename: ticketFilename(reservationId),
          content: await renderTicketPdf(loaded.ticket),
          contentType: "application/pdf",
        },
      ],
    });
  });
}

export function queueBookingCancellation(reservationId: string): void {
  deliverInBackground(reservationId, async () => {
    const loaded = await load(reservationId);
    if (!loaded) return;

    const email = bookingCancelledEmail(toEmailData(loaded.ticket, loaded.user.name));
    await sendMail({ to: loaded.user.email, ...email });
  });
}
