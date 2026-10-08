import { z } from "zod";

export const weatherQuerySchema = z.object({
  city: z.string().trim().min(1, "Say which city."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date."),
});
