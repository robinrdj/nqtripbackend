import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async route handler so a rejected promise reaches the error
 * middleware. Express 5 does this natively, but wrapping keeps the behaviour
 * explicit and identical across every route.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
