import { Schema, model, type InferSchemaType } from "mongoose";
import { applyJsonTransform } from "./plugins.js";

const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    adventure: { type: String, ref: "Adventure", required: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

// One review per person per adventure — enforced by the database rather than a
// check-then-insert, which would race.
reviewSchema.index({ user: 1, adventure: 1 }, { unique: true });
reviewSchema.index({ adventure: 1, createdAt: -1 });

applyJsonTransform(reviewSchema);

export type ReviewDoc = InferSchemaType<typeof reviewSchema>;
export const Review = model("Review", reviewSchema);
