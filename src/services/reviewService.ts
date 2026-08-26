import { Types } from "mongoose";
import { Adventure } from "../models/Adventure.js";
import { Reservation } from "../models/Reservation.js";
import { Review } from "../models/Review.js";
import { AppError } from "../utils/AppError.js";
import type { CreateReviewInput } from "../schemas/reviews.js";

/**
 * Recomputes the denormalised rating on the adventure.
 *
 * Run after every write rather than incrementally adjusted, so the stored
 * average can never drift out of step with the rows it summarises.
 */
async function refreshRating(adventureId: string): Promise<void> {
  const [stats] = await Review.aggregate([
    { $match: { adventure: adventureId } },
    {
      $group: {
        _id: "$adventure",
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  await Adventure.updateOne(
    { _id: adventureId },
    {
      $set: {
        ratingAverage: stats ? Math.round(stats.average * 10) / 10 : 0,
        ratingCount: stats ? stats.count : 0,
      },
    }
  );
}

export async function createOrUpdateReview(
  adventureId: string,
  userId: string,
  input: CreateReviewInput
) {
  const adventure = await Adventure.findById(adventureId).lean();
  if (!adventure) throw AppError.notFound("We could not find that adventure.");

  // Only people who actually booked it may review it - the single most common
  // reason review sections stop being worth reading.
  const hasBooked = await Reservation.exists({
    adventure: adventureId,
    user: new Types.ObjectId(userId),
    status: "confirmed",
  });

  if (!hasBooked) {
    throw AppError.forbidden(
      "You can review an adventure once you have booked it."
    );
  }

  const review = await Review.findOneAndUpdate(
    { adventure: adventureId, user: new Types.ObjectId(userId) },
    { $set: { rating: input.rating, title: input.title, body: input.body } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  ).populate("user", "name avatarUrl");

  await refreshRating(adventureId);

  return review.toJSON();
}

export async function deleteReview(
  reviewId: string,
  userId: string,
  isAdmin: boolean
) {
  const review = await Review.findById(reviewId);
  if (!review) throw AppError.notFound("We could not find that review.");

  if (!isAdmin && review.user.toString() !== userId) {
    throw AppError.forbidden("That review belongs to someone else.");
  }

  const adventureId = review.adventure;
  await review.deleteOne();
  await refreshRating(adventureId);
}

const REVIEW_SORTS = {
  newest: { createdAt: -1 },
  highest: { rating: -1, createdAt: -1 },
  lowest: { rating: 1, createdAt: -1 },
} as const;

export async function listReviews(
  adventureId: string,
  options: { page: number; limit: number; sort: keyof typeof REVIEW_SORTS }
) {
  const skip = (options.page - 1) * options.limit;

  const [items, total, distribution] = await Promise.all([
    Review.find({ adventure: adventureId })
      .sort(REVIEW_SORTS[options.sort])
      .skip(skip)
      .limit(options.limit)
      .populate("user", "name avatarUrl")
      .lean(),
    Review.countDocuments({ adventure: adventureId }),
    Review.aggregate([
      { $match: { adventure: adventureId } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]),
  ]);

  // Always five buckets, so the UI can render the histogram without filling in
  // the gaps itself.
  const buckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distribution as { _id: number; count: number }[]) {
    buckets[row._id] = row.count;
  }

  return {
    items: items.map((doc) => {
      const { _id, __v, ...rest } = doc as Record<string, unknown> & {
        _id: unknown;
      };
      return { id: String(_id), ...rest };
    }),
    page: options.page,
    limit: options.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / options.limit)),
    distribution: buckets,
  };
}
