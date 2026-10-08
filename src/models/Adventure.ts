import { Schema, model, type InferSchemaType } from "mongoose";
import { applyJsonTransform } from "./plugins.js";
import { locationSchema } from "./location.js";

export const ADVENTURE_CATEGORIES = [
  "Beaches",
  "Cycling",
  "Hillside",
  "Party",
] as const;

export type AdventureCategory = (typeof ADVENTURE_CATEGORIES)[number];

/**
 * `_id` is the legacy numeric-string id ("2447910730") so that bookmarked
 * detail URLs from the old app keep resolving. New adventures get a nanoid.
 *
 * The old API split this record across two endpoints — `/adventures` returned
 * the card fields and `/adventures/detail` returned the prose — which is why
 * the old detail payload was missing `duration`, `category` and `image`. Here
 * it is one document; the legacy routes project out the subset each used to
 * return.
 */
const adventureSchema = new Schema(
  {
    _id: { type: String, required: true },

    city: { type: String, required: true, ref: "City" },

    name: { type: String, required: true, trim: true },
    subtitle: { type: String, default: "", trim: true },
    content: { type: String, default: "" },

    image: { type: String, required: true },
    images: { type: [String], default: [] },
    // Attribution for `images`, in the same order. The seeded photos come from
    // Wikimedia Commons, and most of their licences require crediting the author.
    photoCredits: {
      type: [
        new Schema(
          {
            author: { type: String, required: true },
            license: { type: String, required: true },
            source: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    category: { type: String, required: true, enum: ADVENTURE_CATEGORIES },
    duration: { type: Number, required: true, min: 0 },
    costPerHead: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    // Capacity is what makes a booking able to fail. The old app had a single
    // boolean that flipped on first reservation and never came back.
    capacity: { type: Number, required: true, min: 0, default: 20 },
    booked: { type: Number, required: true, min: 0, default: 0 },

    // Maintained by the review service; denormalised so cards can show stars
    // without a per-card aggregation.
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },

    // Optional so documents written before the map existed still validate;
    // the seed backfills it.
    location: { type: locationSchema, required: false },
  },
  { timestamps: true, _id: false }
);

/** Seats still on sale. */
adventureSchema.virtual("seatsLeft").get(function () {
  return Math.max(0, this.capacity - this.booked);
});

/** Kept so legacy clients that read `available`/`reserved` still work. */
adventureSchema.virtual("available").get(function () {
  return this.capacity - this.booked > 0;
});

adventureSchema.virtual("reserved").get(function () {
  return this.booked > 0;
});

// Drives the filtered list endpoint: city is always an equality match, and the
// remaining fields are the facets the UI filters and sorts on.
adventureSchema.index({ city: 1, category: 1, duration: 1 });
adventureSchema.index({ city: 1, costPerHead: 1 });
adventureSchema.index({ ratingAverage: -1 });
adventureSchema.index({ name: "text", subtitle: "text", content: "text" });

applyJsonTransform(adventureSchema);

export type AdventureDoc = InferSchemaType<typeof adventureSchema>;
export const Adventure = model("Adventure", adventureSchema);
