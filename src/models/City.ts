import { Schema, model, type InferSchemaType } from "mongoose";
import { applyJsonTransform } from "./plugins.js";

/**
 * `_id` is the city slug ("bengaluru"), not an ObjectId. The slug is already
 * unique, stable and human-readable, and it is what `/adventures?city=` has
 * always taken — so using it directly avoids a lookup on every request.
 */
const citySchema = new Schema(
  {
    _id: { type: String, required: true },
    city: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    country: { type: String, trim: true },
    // Denormalised so the landing page can show a count without an aggregation.
    adventureCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, _id: false }
);

citySchema.index({ city: "text", description: "text" });

applyJsonTransform(citySchema);

export type CityDoc = InferSchemaType<typeof citySchema>;
export const City = model("City", citySchema);
