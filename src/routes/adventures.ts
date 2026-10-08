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
import * as liveEvents from "../services/liveEvents.js";
import { AppError } from "../utils/AppError.js";
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

/**
 * Server-Sent Events: seat counts and "people viewing", pushed as they change.
 *
 * SSE rather than WebSockets because the traffic is one-way, it rides plain
 * HTTP through every proxy (Vite's, Netlify's), carries the auth cookie like
 * any request, and the browser's EventSource reconnects on its own.
 */
router.get(
  "/:id/live",
  validate({ params: adventureIdParamSchema }),
  asyncHandler(async (req, res) => {
    const id = pathParam(req, "id");

    // Checked before the stream opens, while a normal error response is still
    // possible. Once the headers are out, errors can only end the stream.
    const snapshot = await liveEvents.seatSnapshot(id);
    if (!snapshot) {
      throw AppError.notFound(`We could not find an adventure with id "${id}".`);
    }
    if (!liveEvents.canOpenStream()) {
      throw new AppError(503, "Live updates are busy right now.", "UNAVAILABLE");
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform stops proxies compressing the stream, which would buffer it.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tells nginx-style proxies not to buffer, or events arrive in batches.
      "X-Accel-Buffering": "no",
    });

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // How long the browser waits before reconnecting after a drop.
    res.write("retry: 5000\n\n");
    send("seats", snapshot);

    const unsubscribe = liveEvents.subscribe(id, (event) => send(event.type, event.data));

    // A comment line every 25s keeps idle proxies from closing the connection.
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);

    const untrack = liveEvents.trackStream(() => res.end());

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      untrack();
    });
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
