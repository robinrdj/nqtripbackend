import { Types } from "mongoose";
import { Adventure } from "../models/Adventure.js";
import { Reservation } from "../models/Reservation.js";
import { AppError } from "../utils/AppError.js";
import type { CreateReservationInput } from "../schemas/reservations.js";

/**
 * Books seats.
 *
 * The seat claim is a single conditional update: it only matches while enough
 * seats remain, and increments in the same operation. Because that is atomic on
 * one document, two people racing for the last seat cannot both succeed - no
 * transaction or read-then-write needed, and it works on a standalone mongod as
 * well as on Atlas.
 *
 * If writing the reservation row afterwards fails, the seat claim is released
 * so the count does not drift upward on error.
 */
export async function createReservation(
  input: CreateReservationInput,
  userId: string | undefined
) {
  const claimed = await Adventure.findOneAndUpdate(
    {
      _id: input.adventure,
      $expr: { $lte: [{ $add: ["$booked", input.persons] }, "$capacity"] },
    },
    { $inc: { booked: input.persons } },
    { returnDocument: "after" }
  );

  if (!claimed) {
    // Either the adventure does not exist, or it does but is short on seats.
    const exists = await Adventure.findById(input.adventure).lean();
    if (!exists) {
      throw AppError.notFound(
        `We could not find an adventure with id "${input.adventure}".`
      );
    }
    const seatsLeft = Math.max(0, exists.capacity - exists.booked);
    throw AppError.conflict(
      seatsLeft === 0
        ? `"${exists.name}" is fully booked.`
        : `Only ${seatsLeft} ${
            seatsLeft === 1 ? "seat is" : "seats are"
          } left for "${exists.name}".`
    );
  }

  try {
    const reservation = await Reservation.create({
      user: userId ? new Types.ObjectId(userId) : undefined,
      adventure: claimed._id,
      adventureName: claimed.name,
      city: claimed.city,
      name: titleCase(input.name),
      // Stored as UTC midnight, not local midnight. A booking is a calendar
      // day, not an instant: parsing "2026-08-27" in a UTC+5:30 zone yields
      // 2026-08-26T18:30Z, which reads back as the 26th and shows the customer
      // the wrong day. The "Z" pins it so the date round-trips unchanged.
      date: new Date(`${input.date}T00:00:00.000Z`),
      persons: input.persons,
      price: input.persons * claimed.costPerHead,
    });

    return reservation.toJSON();
  } catch (err) {
    await Adventure.updateOne(
      { _id: claimed._id },
      { $inc: { booked: -input.persons } }
    );
    throw err;
  }
}

/** Frees the seats and marks the row cancelled; only the owner may do this. */
export async function cancelReservation(reservationId: string, userId: string) {
  const reservation = await Reservation.findById(reservationId);

  if (!reservation) throw AppError.notFound("We could not find that booking.");

  if (!reservation.user || reservation.user.toString() !== userId) {
    throw AppError.forbidden("That booking belongs to someone else.");
  }

  if (reservation.status === "cancelled") {
    throw AppError.conflict("That booking is already cancelled.");
  }

  reservation.status = "cancelled";
  reservation.cancelledAt = new Date();
  await reservation.save();

  await Adventure.updateOne(
    { _id: reservation.adventure },
    { $inc: { booked: -reservation.persons } }
  );

  return reservation.toJSON();
}

export async function listReservationsForUser(
  userId: string,
  options: {
    status: "confirmed" | "cancelled" | "all";
    page: number;
    limit: number;
  }
) {
  const filter: Record<string, unknown> = { user: new Types.ObjectId(userId) };
  if (options.status !== "all") filter.status = options.status;

  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    Reservation.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(options.limit)
      .lean(),
    Reservation.countDocuments(filter),
  ]);

  return {
    items: items.map(serialiseReservation),
    page: options.page,
    limit: options.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / options.limit)),
  };
}

function serialiseReservation(doc: Record<string, unknown>) {
  const { _id, __v, ...rest } = doc as Record<string, unknown> & {
    _id: unknown;
  };
  return { id: String(_id), ...rest };
}

/** Normalises a typed name to title case for display. */
function titleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
