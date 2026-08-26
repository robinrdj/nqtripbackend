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
