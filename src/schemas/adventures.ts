import { z } from "zod";
import { ADVENTURE_CATEGORIES } from "../models/Adventure.js";

/** Repeatable query params arrive as string | string[]; normalise to an array. */
const csvArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const parts = Array.isArray(value) ? value : value.split(",");
    const cleaned = parts.map((p) => p.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  });

export const SORT_OPTIONS = [
  "recommended",
  "price-asc",
  "price-desc",
  "duration-asc",
  "duration-desc",
  "rating",
] as const;

export const listAdventuresQuerySchema = z.object({
  city: z.string().trim().min(1).optional(),
  q: z.string().trim().max(120).optional(),

  category: csvArray.pipe(
    z.array(z.enum(ADVENTURE_CATEGORIES)).optional()
  ),

  // Duration is a closed range in hours; the UI sends both halves.
  durationMin: z.coerce.number().min(0).max(48).optional(),
  durationMax: z.coerce.number().min(0).max(48).optional(),

  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),

  sort: z.enum(SORT_OPTIONS).default("recommended"),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
})
  .refine(
    (v) => v.durationMin === undefined || v.durationMax === undefined || v.durationMin <= v.durationMax,
    { message: "The minimum duration cannot exceed the maximum.", path: ["durationMin"] }
  )
  .refine(
    (v) => v.priceMin === undefined || v.priceMax === undefined || v.priceMin <= v.priceMax,
    { message: "The minimum price cannot exceed the maximum.", path: ["priceMin"] }
  );

export type ListAdventuresQuery = z.infer<typeof listAdventuresQuerySchema>;

export const adventureIdParamSchema = z.object({
  id: z.string().trim().min(1),
});
