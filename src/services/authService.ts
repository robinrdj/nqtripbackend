import { env } from "../config/env.js";
import { User, hashPassword } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { verifyGoogleCredential, type GoogleProfile } from "../utils/googleIdentity.js";
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

  // A Google-only account has no password to compare against, and gets the
  // same answer as an unknown one - telling them apart would reveal that the
  // address is registered.
  if (!user || !user.passwordHash) {
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

  if (!user.passwordHash) {
    throw AppError.badRequest(
      "This account signs in with Google, so it has no password to change."
    );
  }

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

/** What the sign-in page can offer. The Google client id is public by design. */
export function authProviders() {
  return {
    password: true,
    google: env.GOOGLE_CLIENT_ID
      ? { enabled: true as const, clientId: env.GOOGLE_CLIENT_ID }
      : { enabled: false as const },
  };
}

/**
 * Signs in with a Google ID token, creating or linking the account as needed.
 *
 * Matching order:
 * 1. An account already linked to this Google id - the normal returning case.
 * 2. An account with the same email - linked, but only when Google says it
 *    has verified that address. Linking on an unverified email would let
 *    someone who registers the victim's address at Google take over the
 *    victim's QTrip account.
 * 3. Otherwise, a new account with no password.
 */
export async function loginWithGoogle(credential: string): Promise<AuthResult> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(404, "Google sign-in is not enabled on this server.", "NOT_ENABLED");
  }

  let profile: GoogleProfile;
  try {
    profile = await verifyGoogleCredential(credential);
  } catch {
    throw AppError.unauthorized("We could not verify your Google sign-in. Please try again.");
  }

  if (!profile.emailVerified) {
    throw AppError.unauthorized(
      "Your Google account's email is not verified, so we cannot sign you in with it."
    );
  }

  let user = await User.findOne({ googleId: profile.sub });

  if (!user) {
    user = await User.findOne({ email: profile.email });
    if (user) {
      user.googleId = profile.sub;
      if (!user.avatarUrl && profile.picture) user.avatarUrl = profile.picture;
      await user.save();
    }
  }

  user ??= await User.create({
    name: profile.name.slice(0, 80),
    email: profile.email,
    googleId: profile.sub,
    ...(profile.picture ? { avatarUrl: profile.picture } : {}),
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
