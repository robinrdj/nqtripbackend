import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../utils/AppError.js";
import { ACCESS_COOKIE, verifyAccessToken } from "../utils/tokens.js";

export interface AuthenticatedUser {
  id: string;
  role: "user" | "admin";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Reads the access token from the httpOnly cookie, falling back to a bearer
 * header so the API stays usable from curl, Swagger UI and tests.
 */
function readToken(req: Request): string | null {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  if (cookie) return cookie;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);

  return null;
}

/** Attaches `req.user` when a valid token is present; never rejects. */
export const attachUser: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    // An expired or tampered token is treated as "signed out" here. Routes that
    // require a user reject below; optional-auth routes carry on anonymously.
  }
  next();
};

/** Rejects the request unless a valid token identified a user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(AppError.unauthorized());
  }
  next();
}

export function requireRole(role: "admin"): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (req.user.role !== role) return next(AppError.forbidden());
    next();
  };
}
