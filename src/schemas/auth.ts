import { z } from "zod";

/**
 * These schemas are the contract. The frontend imports the same shapes for its
 * react-hook-form resolvers, so a rule only ever gets written once and the
 * client cannot drift from what the server will accept.
 */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "That is too long.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.");

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tell us your name.")
    .max(80, "That name is too long."),
  email: z.string().trim().toLowerCase().email("That is not a valid email."),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("That is not a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
