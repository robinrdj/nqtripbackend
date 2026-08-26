import { User, hashPassword } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens.js";
import type { LoginInput, RegisterInput } from "../schemas/auth.js";

export interface AuthResult {
  user: Record<string, unknown>;
  tokens: { access: string; refresh: string };
}

function issueTokens(user: {
  id: string;
  role: "user" | "admin";
  tokenVersion: number;
}) {
  return {
    access: signAccessToken({ sub: user.id, role: user.role }),
    refresh: signRefreshToken({ sub: user.id, version: user.tokenVersion }),
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await User.exists({ email: input.email });
  if (existing) {
    throw AppError.conflict(
      "An account with that email already exists. Try signing in instead."
    );
  }

  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
  });

  return {
    user: user.toJSON(),
    tokens: issueTokens({
      id: user.id,
      role: user.role as "user" | "admin",
      tokenVersion: user.tokenVersion,
    }),
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  // passwordHash is `select: false` on the schema, so ask for it explicitly.
  const user = await User.findOne({ email: input.email }).select(
    "+passwordHash"
  );

  // Deliberately the same message for "no such account" and "wrong password":
  // distinguishing them turns the login form into an account-enumeration oracle.
  const invalid = AppError.unauthorized("That email or password is not right.");

  if (!user) {
    // Still spend the time a real comparison would, so response timing does not
    // reveal whether the address is registered.
    await hashPassword(input.password);
    throw invalid;
  }

  const ok = await (
    user as unknown as { verifyPassword(p: string): Promise<boolean> }
  ).verifyPassword(input.password);

  if (!ok) throw invalid;

  return {
    user: user.toJSON(),
    tokens: issueTokens({
      id: user.id,
      role: user.role as "user" | "admin",
      tokenVersion: user.tokenVersion,
    }),
  };
}

/**
 * Exchanges a refresh token for a fresh pair.
 *
 * The token carries the `tokenVersion` it was minted against; bumping that
 * column on the user (password change, sign-out-everywhere) invalidates every
 * refresh token in circulation without needing a revocation list.
 */
export async function refresh(token: string | undefined): Promise<AuthResult> {
  if (!token) throw AppError.unauthorized("Your session has expired.");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw AppError.unauthorized("Your session has expired. Please sign in again.");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.version) {
    throw AppError.unauthorized("Your session is no longer valid.");
  }

  return {
    user: user.toJSON(),
    tokens: issueTokens({
      id: user.id,
      role: user.role as "user" | "admin",
      tokenVersion: user.tokenVersion,
    }),
  };
}

export async function getProfile(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound("We could not find your account.");
  return user.toJSON();
}

export async function updateProfile(
  userId: string,
  patch: { name?: string; avatarUrl?: string }
) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: patch },
    { returnDocument: "after", runValidators: true }
  );
  if (!user) throw AppError.notFound("We could not find your account.");
  return user.toJSON();
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw AppError.notFound("We could not find your account.");

  const ok = await (
    user as unknown as { verifyPassword(p: string): Promise<boolean> }
  ).verifyPassword(currentPassword);

  if (!ok) throw AppError.badRequest("Your current password is not right.");

  user.passwordHash = await hashPassword(newPassword);
  // Signs every other device out.
  user.tokenVersion += 1;
  await user.save();

  return issueTokens({
    id: user.id,
    role: user.role as "user" | "admin",
    tokenVersion: user.tokenVersion,
  });
}
