import { Schema, model, type InferSchemaType } from "mongoose";
import bcrypt from "bcryptjs";
import { applyJsonTransform } from "./plugins.js";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // `select: false` so a stray `User.find()` cannot leak hashes into a
    // response; the login path opts back in explicitly.
    //
    // Required unless the account signs in with Google: those accounts may
    // never have had a password, and inventing one would create a credential
    // nobody knows but which still works.
    passwordHash: {
      type: String,
      select: false,
      required(this: { googleId?: string }) {
        return !this.googleId;
      },
    },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    avatarUrl: { type: String },

    // Google's stable account id (the ID token's `sub`). The email can change
    // on Google's side; this cannot. Sparse so password-only accounts, which
    // have none, do not collide on the unique index.
    googleId: { type: String, unique: true, sparse: true },

    // Bumped on password change and logout-everywhere, so refresh tokens issued
    // before that moment stop validating.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.methods.verifyPassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

applyJsonTransform(userSchema);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
