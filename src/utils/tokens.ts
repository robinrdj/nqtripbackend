import jwt, { type SignOptions } from "jsonwebtoken";
import type { Response } from "express";
import { env, isProduction } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  role: "user" | "admin";
}

export interface RefreshTokenPayload {
  sub: string;
  version: number;
}

const ACCESS_COOKIE = "qtrip_access";
const REFRESH_COOKIE = "qtrip_refresh";

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

/**
 * Tokens live in httpOnly cookies rather than localStorage, so a script
 * injected into the page cannot read them.
 *
 * In production the frontend is on a different origin from the API, which means
 * the cookie must be SameSite=None — and browsers only accept that with
 * Secure, hence the pairing.
 */
function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: maxAgeMs,
  };
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function setAuthCookies(
  res: Response,
  tokens: { access: string; refresh: string }
): void {
  res.cookie(ACCESS_COOKIE, tokens.access, cookieOptions(FIFTEEN_MINUTES));
  res.cookie(REFRESH_COOKIE, tokens.refresh, cookieOptions(THIRTY_DAYS));
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, cookieOptions(0));
  res.clearCookie(REFRESH_COOKIE, cookieOptions(0));
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
