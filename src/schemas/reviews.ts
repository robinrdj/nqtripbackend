import { z } from "zod";

export const createReviewSchema = z.object({
  rating: z.coerce
    .number()
    .int("Pick a whole number of stars.")
    .min(1, "Pick at least one star.")
    .max(5, "Five stars is the maximum."),
  title: z.string().trim().max(120, "Keep the title under 120 characters.").optional(),
  body: z
    .string()
    .trim()
    .min(10, "Tell us a little more — at least 10 characters.")
    .max(2000, "That review is too long."),
});

export const listReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(["newest", "highest", "lowest"]).default("newest"),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
