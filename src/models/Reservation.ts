import { Schema, model, type InferSchemaType } from "mongoose";
import { applyJsonTransform } from "./plugins.js";

export const RESERVATION_STATUSES = ["confirmed", "cancelled"] as const;

/**
 * `user` is optional because the seed data predates accounts — those legacy
 * rows carry a name but no owner, and are visible only in the legacy endpoint.
 * Everything created through the v1 API is owned.
 */
const reservationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    adventure: { type: String, ref: "Adventure", required: true, index: true },

    // Denormalised at write time so a cancelled or renamed adventure does not
    // change what the customer's booking record says they bought.
    adventureName: { type: String, required: true },
    city: { type: String },

    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    persons: { type: Number, required: true, min: 1, max: 20 },
    price: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      default: "confirmed",
      index: true,
    },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

// The "My Trips" query: one user's bookings, newest departure first.
reservationSchema.index({ user: 1, date: -1 });

applyJsonTransform(reservationSchema);

export type ReservationDoc = InferSchemaType<typeof reservationSchema>;
export const Reservation = model("Reservation", reservationSchema);
