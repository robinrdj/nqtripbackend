import type { Schema } from "mongoose";

/**
 * Rewrites `_id` to `id` and strips Mongo bookkeeping when a document is
 * serialised to JSON.
 *
 * The existing frontend reads `id` everywhere, and the seeded documents keep
 * their original identifiers as `_id` (city slugs, the legacy numeric adventure
 * ids), so this alone keeps every old URL and API response shape working.
 */
export function applyJsonTransform(schema: Schema): void {
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret: Record<string, unknown>) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.passwordHash;
      return ret;
    },
  });
}
