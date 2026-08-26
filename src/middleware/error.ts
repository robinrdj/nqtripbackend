import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";
import { isProduction } from "../config/env.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
};

/**
 * The single place a response body is produced for a failure.
 *
 * Anything that is not an AppError is treated as a bug: it is logged in full
 * server-side, and the client gets a generic message. That keeps stack traces,
 * driver errors and connection strings out of responses.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const mapped = mapError(err);

  if (mapped.status >= 500) {
    console.error("[error]", err);
  }

  res.status(mapped.status).json({
    error: {
      code: mapped.code,
      message: mapped.message,
      ...(mapped.details ? { details: mapped.details } : {}),
    },
    // Legacy clients read a top-level `message`; the old API sent it that way.
    message: mapped.message,
  });
};

function mapError(err: unknown): {
  status: number;
  code: string;
  message: string;
  details?: unknown;
} {
  if (err instanceof AppError) {
    return {
      status: err.status,
      code: err.code,
      message: err.message,
      details: err.details,
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Some of the values you sent are not valid.",
      details: err.issues.map((issue) => ({
        field: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }

  // Duplicate key — the unique indexes on email, reviews and wishlist rows.
  if (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  ) {
    return {
      status: 409,
      code: "CONFLICT",
      message: "That already exists.",
    };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Some of the values you sent are not valid.",
      details: Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
    };
  }

  if (err instanceof mongoose.Error.CastError) {
    return {
      status: 400,
      code: "BAD_REQUEST",
      message: `"${String(err.value)}" is not a valid ${err.path}.`,
    };
  }

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: isProduction
      ? "Something went wrong on our end."
      : `Unhandled error: ${err instanceof Error ? err.message : String(err)}`,
  };
}
