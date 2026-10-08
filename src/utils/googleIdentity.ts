import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

let client: OAuth2Client | undefined;

/**
 * Verifies a Google Identity Services ID token and returns who it is for.
 *
 * `verifyIdToken` checks the signature against Google's published keys, the
 * expiry, the issuer, and — the part that matters most — that the token was
 * minted for *our* client id. Without the audience check, a token a user gave
 * to any other site could be replayed here to sign in as them.
 *
 * Kept in its own module so tests can stand in for Google.
 */
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  if (!env.GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID is not set");

  client ??= new OAuth2Client(env.GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Google token carried no subject or email");
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name?.trim() || payload.email.split("@")[0]!,
    ...(payload.picture ? { picture: payload.picture } : {}),
  };
}
