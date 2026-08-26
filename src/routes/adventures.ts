import { Router } from "express";
import {
  adventureIdParamSchema,
  listAdventuresQuerySchema,
} from "../schemas/adventures.js";
import { createReviewSchema, listReviewsQuerySchema } from "../schemas/reviews.js";
import { validate, validatedQuery } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as adventureService from "../services/adventureService.js";
import * as reviewService from "../services/reviewService.js";
import * as wishlistService from "../services/wishlistService.js";
import { pathParam } from "../utils/params.js";
import type { ListAdventuresQuery } from "../schemas/adventures.js";

const router = Router();

router.get(
  "/",
  validate({ query: listAdventuresQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<ListAdventuresQuery>(req);
    const result = await adventureService.listAdventures(query);

    // Signed-in visitors get their saved ids alongside, so the list can paint
    // hearts in the first render instead of flashing them in afterwards.
    const savedIds = req.user
      ? await wishlistService.wishlistIds(req.user.id)
      : [];

    res.json({ ...result, savedIds });
  })
);

router.get(
  "/:id",
  validate({ params: adventureIdParamSchema }),
  asyncHandler(async (req, res) => {
    const adventure = await adventureService.getAdventureById(pathParam(req, "id"));
    const saved = req.user
      ? (await wishlistService.wishlistIds(req.user.id)).includes(pathParam(req, "id"))
      : false;
    res.json({ adventure, saved });
  })
);

router.get(
  "/:id/reviews",
  validate({ params: adventureIdParamSchema, query: listReviewsQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<{
      page: number;
      limit: number;
      sort: "newest" | "highest" | "lowest";
    }>(req);
    res.json(await reviewService.listReviews(pathParam(req, "id"), query));
  })
);

router.post(
  "/:id/reviews",
  requireAuth,
  writeLimiter,
  validate({ params: adventureIdParamSchema, body: createReviewSchema }),
  asyncHandler(async (req, res) => {
    const review = await reviewService.createOrUpdateReview(
      pathParam(req, "id"),
      req.user!.id,
      req.body
    );
    res.status(201).json({ review });
  })
);

export default router;
