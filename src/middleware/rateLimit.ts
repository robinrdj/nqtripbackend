import rateLimit from "express-rate-limit";
import { isTest } from "../config/env.js";

/**
 * Limits are disabled under test — otherwise a suite that exercises the login
 * route a dozen times starts failing on the thirteenth assertion for reasons
 * that have nothing to do with the code under test.
 */
function limiter(options: { windowMs: number; max: number; message: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    max: isTest ? 0 : options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    message: {
      error: { code: "RATE_LIMITED", message: options.message },
      message: options.message,
    },
  });
}

/** Broad backstop applied to the whole API. */
export const generalLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: "Too many requests. Please slow down and try again shortly.",
});

/** Tight limit on credential endpoints, to make brute forcing impractical. */
export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many attempts. Please wait a few minutes and try again.",
});

/** Booking is the expensive, side-effecting path. */
export const writeLimiter = limiter({
  windowMs: 60 * 1000,
  max: 20,
  message: "You are doing that too quickly. Please wait a moment.",
});
