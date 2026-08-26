import type { SortOrder } from "mongoose";
import { Adventure } from "../models/Adventure.js";
import { City } from "../models/City.js";
import { AppError } from "../utils/AppError.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import type { ListAdventuresQuery } from "../schemas/adventures.js";

/** Translates the validated query into a Mongo filter. */
function buildFilter(query: ListAdventuresQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.city) filter.city = query.city;
  if (query.category?.length) filter.category = { $in: query.category };

  if (query.durationMin !== undefined || query.durationMax !== undefined) {
    filter.duration = {
      ...(query.durationMin !== undefined ? { $gte: query.durationMin } : {}),
      ...(query.durationMax !== undefined ? { $lte: query.durationMax } : {}),
    };
  }

  if (query.priceMin !== undefined || query.priceMax !== undefined) {
    filter.costPerHead = {
      ...(query.priceMin !== undefined ? { $gte: query.priceMin } : {}),
      ...(query.priceMax !== undefined ? { $lte: query.priceMax } : {}),
    };
  }

  // A regex over name/subtitle rather than $text: it matches partial words, so
  // typing "bea" while the user is still mid-word returns "Beaches" results.
  // The dataset is small enough that the missing index is not a concern.
  if (query.q) {
    const safe = escapeRegex(query.q);
    const rx = new RegExp(safe, "i");
    filter.$or = [{ name: rx }, { subtitle: rx }];
  }

  return filter;
}

const SORTS: Record<string, Record<string, SortOrder>> = {
  "recommended": { ratingAverage: -1, ratingCount: -1, name: 1 },
  "price-asc": { costPerHead: 1, name: 1 },
  "price-desc": { costPerHead: -1, name: 1 },
  "duration-asc": { duration: 1, name: 1 },
  "duration-desc": { duration: -1, name: 1 },
  "rating": { ratingAverage: -1, ratingCount: -1 },
};

export interface PagedAdventures {
  items: unknown[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Facet counts for the current filter, so the UI can grey out empty options. */
  facets: {
    categories: { value: string; count: number }[];
    priceRange: { min: number; max: number } | null;
  };
}

export async function listAdventures(
  query: ListAdventuresQuery
): Promise<PagedAdventures> {
  const filter = buildFilter(query);
  const sort = SORTS[query.sort] ?? SORTS.recommended!;
  const skip = (query.page - 1) * query.limit;

  // The facet counts deliberately ignore the category filter, so that ticking
  // "Party" does not zero out every other checkbox's count and make the other
  // options look unavailable.
  const facetFilter = { ...filter };
  delete facetFilter.category;

  const [items, total, categoryCounts, priceStats] = await Promise.all([
    Adventure.find(filter).sort(sort).skip(skip).limit(query.limit).lean({ virtuals: true }),
    Adventure.countDocuments(filter),
    Adventure.aggregate([
      { $match: facetFilter },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Adventure.aggregate([
      { $match: facetFilter },
      {
        $group: {
          _id: null,
          min: { $min: "$costPerHead" },
          max: { $max: "$costPerHead" },
        },
      },
    ]),
  ]);

  const stats = priceStats[0] as { min: number; max: number } | undefined;

  return {
    items: items.map(serialiseAdventure),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
    facets: {
      categories: (categoryCounts as { _id: string; count: number }[]).map((c) => ({
        value: c._id,
        count: c.count,
      })),
      priceRange: stats ? { min: stats.min, max: stats.max } : null,
    },
  };
}

export async function getAdventureById(id: string) {
  const doc = await Adventure.findById(id).lean({ virtuals: true });
  if (!doc) {
    throw AppError.notFound(`We could not find an adventure with id "${id}".`);
  }
  return serialiseAdventure(doc);
}

export interface CitySummary {
  id: string;
  city: string;
  description: string;
  image: string;
  country?: string;
  adventureCount: number;
}

export async function listCities(): Promise<CitySummary[]> {
  const cities = await City.find().sort({ city: 1 }).lean();
  return cities.map(toCitySummary);
}

export async function getCityById(id: string): Promise<CitySummary> {
  const city = await City.findById(id).lean();
  if (!city) throw AppError.notFound(`We could not find the city "${id}".`);
  return toCitySummary(city);
}

/** Shapes a lean city document into the public payload. */
function toCitySummary(doc: Record<string, unknown>): CitySummary {
  return {
    id: String(doc._id),
    city: String(doc.city),
    description: String(doc.description),
    image: String(doc.image),
    ...(doc.country ? { country: String(doc.country) } : {}),
    adventureCount: Number(doc.adventureCount ?? 0),
  };
}

/** `lean()` skips the toJSON transform, so `_id` -> `id` happens here instead. */
function serialiseAdventure(doc: Record<string, unknown>) {
  const { _id, __v, ...rest } = doc as Record<string, unknown> & { _id: string };
  const capacity = Number(rest.capacity ?? 0);
  const booked = Number(rest.booked ?? 0);
  const seatsLeft = Math.max(0, capacity - booked);

  return {
    id: _id,
    ...rest,
    seatsLeft,
    // Legacy field names the old frontend still reads.
    available: seatsLeft > 0,
    reserved: booked > 0,
  };
}
