import { Types } from "mongoose";
import { Adventure } from "../models/Adventure.js";
import { Wishlist } from "../models/Wishlist.js";
import { AppError } from "../utils/AppError.js";

/**
 * Adds or removes a saved adventure and reports the resulting state.
 *
 * Returning the new state rather than "created"/"deleted" lets the client
 * reconcile an optimistic heart toggle against the truth in one round trip,
 * including when two tabs raced and the answer is not what it assumed.
 */
export async function toggleWishlist(
  userId: string,
  adventureId: string
): Promise<{ saved: boolean }> {
  const exists = await Adventure.exists({ _id: adventureId });
  if (!exists) throw AppError.notFound("We could not find that adventure.");

  const user = new Types.ObjectId(userId);

  const removed = await Wishlist.findOneAndDelete({
    user,
    adventure: adventureId,
  });

  if (removed) return { saved: false };

  await Wishlist.create({ user, adventure: adventureId });
  return { saved: true };
}

/** The saved adventures themselves, not just the join rows. */
export async function listWishlist(userId: string) {
  const rows = await Wishlist.find({ user: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean();

  const ids = rows.map((row) => row.adventure);
  const adventures = await Adventure.find({ _id: { $in: ids } }).lean();

  // Mongo returns the adventures in index order, not the order they were
  // saved in; re-sort to match the wishlist so the newest save stays first.
  const byId = new Map(adventures.map((a) => [a._id, a]));

  return ids
    .map((id) => byId.get(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((doc) => {
      const { _id, __v, ...rest } = doc as Record<string, unknown> & {
        _id: string;
      };
      const capacity = Number(rest.capacity ?? 0);
      const booked = Number(rest.booked ?? 0);
      return {
        id: _id,
        ...rest,
        seatsLeft: Math.max(0, capacity - booked),
        available: capacity - booked > 0,
      };
    });
}

/** The set of ids this user has saved, for painting hearts on a list page. */
export async function wishlistIds(userId: string): Promise<string[]> {
  const rows = await Wishlist.find({ user: new Types.ObjectId(userId) })
    .select("adventure")
    .lean();
  return rows.map((row) => row.adventure);
}
