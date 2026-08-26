import type { Request } from "express";
import { AppError } from "./AppError.js";

/**
 * Reads a path parameter as a string.
 *
 * Express 5 types params as `string | string[]`, because a route pattern can
 * bind one name more than once. None of ours do, but narrowing here once is
 * better than a non-null assertion at every call site — and it turns a
 * malformed URL into a 400 rather than an unhandled `undefined` flowing into a
 * database query.
 */
export function pathParam(req: Request, name: string): string {
  const value = (req.params as Record<string, string | string[] | undefined>)[
    name
  ];

  if (typeof value === "string" && value !== "") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];

  throw AppError.badRequest(`The URL is missing a "${name}" value.`);
}

/** Same idea for a single-valued query parameter. */
export function queryParam(req: Request, name: string): string | undefined {
  const value = (req.query as Record<string, unknown>)[name];
  if (typeof value === "string" && value !== "") return value;
  return undefined;
}
