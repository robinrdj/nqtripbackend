import { Schema, model, type InferSchemaType } from "mongoose";
import { applyJsonTransform } from "./plugins.js";
import { locationSchema } from "./location.js";

/**
 * `_id` is the city slug ("goa"), not an ObjectId. The slug is already
 * unique, stable and human-readable, and it is what `/adventures?city=` has
 * always taken — so using it directly avoids a lookup on every request.
 */
const citySchema = new Schema(
  {
    _id: { type: String, required: true },
    city: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    // Attribution for `image`; the seeded photos come from Wikimedia Commons.
    photoCredit: {
      type: new Schema(
        {
          author: { type: String, required: true },
          license: { type: String, required: true },
          source: { type: String, required: true },
        },
        { _id: false }
      ),
      required: false,
    },
    country: { type: String, trim: true },
    // Denormalised so the landing page can show a count without an aggregation.
    adventureCount: { type: Number, default: 0, min: 0 },
    // Centres the map, and is where the weather forecast is read for.
    location: { type: locationSchema, required: false },
  },
  { timestamps: true, _id: false }
);

citySchema.index({ city: "text", description: "text" });

applyJsonTransform(citySchema);

export type CityDoc = InferSchemaType<typeof citySchema>;
export const City = model("City", citySchema);
