import { z } from "zod";

/**
 * Today as a YYYY-MM-DD string in the server's own zone.
 *
 * The comparison below is done on strings rather than Dates deliberately: both
 * sides are calendar days, and converting them to instants first reintroduces a
 * timezone offset that can shift the verdict by a day near midnight.
 */
function todayAsDateString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export const createReservationSchema = z.object({
  adventure: z.string().trim().min(1, "Pick an adventure."),
  name: z
    .string()
    .trim()
    .min(2, "Tell us who the booking is for.")
    .max(80, "That name is too long."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker to choose a day.")
    .refine((value) => !Number.isNaN(Date.parse(value)), "That is not a real date.")
    // Lexicographic order matches chronological order for zero-padded ISO dates.
    .refine(
      (value) => value >= todayAsDateString(),
      "You cannot book a date in the past."
    ),
  persons: z.coerce
    .number()
    .int("Enter a whole number of people.")
    .min(1, "At least one person.")
    .max(20, "For groups over 20, please contact us."),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const listReservationsQuerySchema = z.object({
  status: z.enum(["confirmed", "cancelled", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
