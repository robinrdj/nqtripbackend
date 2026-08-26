/**
 * Escapes every character that means something to the regex engine, so a
 * search term can be matched literally.
 *
 * Without this, a visitor typing "(" into the search box builds an invalid
 * pattern and `new RegExp` throws — and a term like ".*" would match every
 * adventure in the database.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
