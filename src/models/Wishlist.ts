import { Schema, model, type InferSchemaType } from "mongoose";
import { applyJsonTransform } from "./plugins.js";

/**
 * One row per saved adventure rather than an array on the user, so the toggle
 * is a single upsert/delete with no read-modify-write race between devices.
 */
const wishlistSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    adventure: { type: String, ref: "Adventure", required: true },
  },
  { timestamps: true }
);

wishlistSchema.index({ user: 1, adventure: 1 }, { unique: true });
wishlistSchema.index({ user: 1, createdAt: -1 });

applyJsonTransform(wishlistSchema);

export type WishlistDoc = InferSchemaType<typeof wishlistSchema>;
export const Wishlist = model("Wishlist", wishlistSchema);
