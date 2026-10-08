import rateLimit from "express-rate-limit";
import { env, isProduction, isTest } from "../config/env.js";

/**
 * Limits are disabled under test — otherwise a suite that exercises the login
 * route a dozen times starts failing on the thirteenth assertion for reasons
 * that have nothing to do with the code under test.
 *
 * DISABLE_RATE_LIMIT does the same for the browser suite, which drives a dev
 * server from one IP far harder than any person would. It is ignored in
 * production, so a stray copy of the variable cannot open a deployed API up.
 */
const limitsOff = isTest || (env.DISABLE_RATE_LIMIT && !isProduction);

function limiter(options: { windowMs: number; max: number; message: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    max: limitsOff ? 0 : options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => limitsOff,
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
