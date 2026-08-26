import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate, validatedQuery } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { listReviewsQuerySchema } from "../schemas/reviews.js";
import * as adventureService from "../services/adventureService.js";
import * as reviewService from "../services/reviewService.js";
import * as wishlistService from "../services/wishlistService.js";
import authRoutes from "./auth.js";
import adventureRoutes from "./adventures.js";
import reservationRoutes from "./reservations.js";
import { pathParam } from "../utils/params.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/adventures", adventureRoutes);
router.use("/reservations", reservationRoutes);

router.get(
  "/cities",
  asyncHandler(async (_req, res) => {
    res.json({ items: await adventureService.listCities() });
  })
);

router.get(
  "/cities/:id",
  asyncHandler(async (req, res) => {
    res.json({ city: await adventureService.getCityById(pathParam(req, "id")) });
  })
);

router.get(
  "/wishlist",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ items: await wishlistService.listWishlist(req.user!.id) });
  })
);

router.post(
  "/wishlist/:adventureId",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    res.json(
      await wishlistService.toggleWishlist(req.user!.id, pathParam(req, "adventureId"))
    );
  })
);

router.delete(
  "/reviews/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    await reviewService.deleteReview(
      pathParam(req, "id"),
      req.user!.id,
      req.user!.role === "admin"
    );
    res.status(204).end();
  })
);

// Kept alongside the nested /adventures/:id/reviews route so a review widget
// can be pointed at a flat URL when that reads better on the client.
router.get(
  "/reviews",
  validate({ query: listReviewsQuerySchema }),
  asyncHandler(async (req, res) => {
    const adventure =
      typeof req.query.adventure === "string" ? req.query.adventure : "";
    const query = validatedQuery<{
      page: number;
      limit: number;
      sort: "newest" | "highest" | "lowest";
    }>(req);
    res.json(await reviewService.listReviews(adventure, query));
  })
);

export default router;
