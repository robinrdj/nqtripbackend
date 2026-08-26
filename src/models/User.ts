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
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    avatarUrl: { type: String },

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
