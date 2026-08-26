import type { RequestHandler } from "express";
import type { ZodType } from "zod";

/**
 * Replaces `req.body` / `req.query` / `req.params` with the parsed result, so
 * handlers downstream read typed, coerced, trimmed values rather than raw
 * strings. A failure throws a ZodError, which the error middleware renders as a
 * per-field 400.
 */
export function validate(schemas: {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) {
        Object.assign(req.params, schemas.params.parse(req.params));
      }
      if (schemas.query) {
        // Express 5 makes req.query a getter, so mutate rather than assign.
        const parsed = schemas.query.parse(req.query) as Record<string, unknown>;
        Object.defineProperty(req, "validatedQuery", {
          value: parsed,
          writable: true,
          configurable: true,
        });
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Typed accessor for what `validate({ query })` parsed. */
export function validatedQuery<T>(req: unknown): T {
  return (req as { validatedQuery: T }).validatedQuery;
}
