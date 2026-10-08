import { Schema } from "mongoose";

/**
 * A point on the map, shared by cities and adventures.
 *
 * Stored as plain lat/lng rather than GeoJSON: nothing queries by distance yet,
 * and a `2dsphere` index can be added over these fields later without a data
 * migration if "adventures near me" ever becomes a feature.
 */
export const locationSchema = new Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false }
);
