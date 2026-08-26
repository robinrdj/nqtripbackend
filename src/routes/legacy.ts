import { Router } from "express";
import { Adventure } from "../models/Adventure.js";
import { Reservation } from "../models/Reservation.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as adventureService from "../services/adventureService.js";
import * as reservationService from "../services/reservationService.js";

/**
 * The pre-Mongo API surface, kept working against the new data model.
 *
 * The deployed frontend and the bookmarks people already have point at these
 * paths, so they keep responding with byte-compatible payloads while the client
 * migrates to /api/v1. Everything here is a projection over the same documents
 * the v1 routes serve - there is no second copy of the data.
 *
 * Deliberate difference: GET /reservations used to return every booking in the
 * system to anyone. It now returns only the unowned rows from the original seed
 * data, so the legacy page still renders without leaking real customers.
 */
const router = Router();

router.get(
  "/cities",
  asyncHandler(async (_req, res) => {
    const cities = await adventureService.listCities();
    // The old payload had exactly these four keys, in this order.
    res.json(
      cities.map((c) => ({
        id: c.id,
        city: c.city,
        description: c.description,
        image: c.image,
      }))
    );
  })
);

router.get(
  "/adventures",
  asyncHandler(async (req, res) => {
    const city = typeof req.query.city === "string" ? req.query.city : "";
    if (!city) {
      throw AppError.badRequest("Adventure not found for undefined!");
    }

    const adventures = await Adventure.find({ city })
      .sort({ name: 1 })
      .lean();

    if (adventures.length === 0) {
      throw AppError.badRequest(`Adventure not found for ${city}!`);
    }

    res.json(
      adventures.map((a) => ({
        id: a._id,
        name: a.name,
        costPerHead: a.costPerHead,
        currency: a.currency,
        image: a.image,
        duration: a.duration,
        category: a.category,
      }))
    );
  })
);

router.get(
  "/adventures/detail",
  asyncHandler(async (req, res) => {
    const id =
      typeof req.query.adventure === "string" ? req.query.adventure : "";

    const adventure = await Adventure.findById(id).lean();
    if (!adventure) {
      throw AppError.badRequest(`Adventure details not found for ${id}!`);
    }

    const seatsLeft = Math.max(0, adventure.capacity - adventure.booked);

    res.json({
      id: adventure._id,
      name: adventure.name,
      subtitle: adventure.subtitle,
      images: adventure.images,
      content: adventure.content,
      available: seatsLeft > 0,
      reserved: adventure.booked > 0,
      costPerHead: adventure.costPerHead,
    });
  })
);

router.post(
  "/reservations/new",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;

    if (!(body.name && body.date && body.person && body.adventure)) {
      throw AppError.badRequest("Invalid data received");
    }

    const persons = Number(body.person);
    if (!Number.isFinite(persons) || persons < 1) {
      throw AppError.badRequest("Invalid data received");
    }

    // The old endpoint compared against "now", so booking today's date failed.
    // That behaviour is preserved here rather than quietly relaxed.
    const requested = new Date(String(body.date));
    if (!(requested.getTime() > Date.now())) {
      throw AppError.badRequest(
        "Date of booking is incorrect. Can't book for a past date!"
      );
    }

    await reservationService.createReservation(
      {
        adventure: String(body.adventure),
        name: String(body.name),
        date: String(body.date).slice(0, 10),
        persons,
      },
      // Anonymous: these rows have no owner, matching the old behaviour.
      req.user?.id
    );

    res.json({ success: true });
  })
);

router.get(
  "/reservations",
  asyncHandler(async (_req, res) => {
    const reservations = await Reservation.find({ user: { $exists: false } })
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      reservations.map((r) => ({
        id: String(r._id),
        name: r.name,
        date: r.date.toISOString().slice(0, 10),
        // The old field was a zero-padded string.
        person: String(r.persons).padStart(2, "0"),
        adventure: r.adventure,
        adventureName: r.adventureName,
        price: r.price,
        time: r.createdAt.toString(),
      }))
    );
  })
);

export default router;
