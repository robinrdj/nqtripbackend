import { Router } from "express";
import {
  createReservationSchema,
  listReservationsQuerySchema,
} from "../schemas/reservations.js";
import { validate, validatedQuery } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as reservationService from "../services/reservationService.js";
import { pathParam } from "../utils/params.js";

const router = Router();

/**
 * Every route here requires a session. The old API exposed every reservation in
 * the system to anyone who asked; a booking is now owned, and only its owner
 * can read or cancel it.
 */
router.use(requireAuth);

router.get(
  "/",
  validate({ query: listReservationsQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<{
      status: "confirmed" | "cancelled" | "all";
      page: number;
      limit: number;
    }>(req);
    res.json(await reservationService.listReservationsForUser(req.user!.id, query));
  })
);

router.post(
  "/",
  writeLimiter,
  validate({ body: createReservationSchema }),
  asyncHandler(async (req, res) => {
    const reservation = await reservationService.createReservation(
      req.body,
      req.user!.id
    );
    res.status(201).json({ reservation });
  })
);

router.post(
  "/:id/cancel",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const reservation = await reservationService.cancelReservation(
      pathParam(req, "id"),
      req.user!.id
    );
    res.json({ reservation });
  })
);

export default router;
