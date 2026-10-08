import "dotenv/config";
import { z } from "zod";

/**
 * Every environment variable the server reads, validated once at boot.
 *
 * Parsing here rather than at each use site means a misconfigured deploy fails
 * immediately with a readable message, instead of throwing something obscure on
 * the first request that happens to touch the missing value.
 */
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(8082),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET is too short"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET is too short"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("30d"),

  // Comma-separated browser origins allowed to send credentialed requests.
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:8081,http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),

  // Where the web client lives. Links in emails and the URL inside a ticket's
  // QR code point here, so it must be an address a customer can open.
  PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:8081")
    .transform((value) => value.replace(/\/+$/, "")),

  // Every setting below is optional. Leaving one unset switches its feature
  // off (or to a local stand-in) rather than stopping the server from booting,
  // so a fresh clone still runs with nothing but a database URI.

  // e.g. smtps://user:pass@smtp.example.com:465. When unset, mail is written
  // to .mail-outbox/ instead of being sent.
  SMTP_URL: z.string().min(1).optional(),
  MAIL_FROM: z.string().default("QTrip <no-reply@qtrip.dev>"),

  // OAuth client id from the Google Cloud console. Unset hides the button.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),

  // Signs the QR code on tickets. Falls back to a key derived from the access
  // token secret, so it only needs setting to rotate tickets independently.
  TICKET_SECRET: z.string().min(16).optional(),

  // For the end-to-end suite only; has no effect when NODE_ENV=production.
  DISABLE_RATE_LIMIT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${issues}\n\n` +
      `Copy .env.example to .env and fill in the missing values.`
  );
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
