# QTrip API

REST API for QTrip, a travel adventure booking app: browse cities, filter
adventures server-side, book seats against real capacity, save favourites and
leave reviews.

Express 5 · TypeScript (strict) · MongoDB + Mongoose 8 · Zod · JWT · Vitest

## Getting started

Requires Node 20+ and a MongoDB connection string (Atlas or local).

```bash
npm install
cp .env.example .env     # then fill in MONGODB_URI and the two JWT secrets
npm run seed             # migrates db.json into MongoDB
npm run dev              # http://localhost:8082
```

Generate the JWT secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Interactive API docs are at **http://localhost:8082/api/docs**.

| Command | What it does |
| --- | --- |
| `npm run dev` | Watch mode via tsx |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | 76 tests against an in-memory MongoDB |
| `npm run typecheck` | Type-check without emitting |
| `npm run seed` | Migrate `db.json`, leaving existing rows alone |
| `npm run seed:fresh` | Drop the collections first |

## Demo accounts

Created by the seed, so the app is clickable without registering:

| Email | Password | Role |
| --- | --- | --- |
| `demo@qtrip.dev` | `Demo1234` | traveller |
| `admin@qtrip.dev` | `Admin1234` | admin |

## Layout

```
src/
  app.ts              Express app: middleware order, route mounting
  index.ts            Boot, graceful shutdown
  config/env.ts       Zod-validated environment, parsed once at startup
  db/connect.ts       Mongoose connection
  models/             City, Adventure, User, Reservation, Review, Wishlist
  schemas/            Zod request schemas - the API contract
  middleware/         auth, validate, error, rateLimit
  services/           Business logic; routes stay thin
  routes/             /api/v1 endpoints
  routes/legacy.ts    Pre-MongoDB endpoints, kept working
  seed/seed.ts        db.json -> MongoDB migration
  docs/openapi.ts     OpenAPI 3 description served at /api/docs
tests/                Supertest suites against mongodb-memory-server
```

## Data model notes

**Identifiers carry over from the old JSON file.** Cities use their slug as
`_id` (`bengaluru`), adventures keep their legacy numeric id (`2447910730`). So
existing bookmarks and the deployed frontend keep resolving, and the migration
is idempotent — re-running the seed updates rows rather than duplicating them.

**Adventures are one document, not two.** The old API split each adventure
across `/adventures` (card fields) and `/adventures/detail` (prose), which is
why the detail payload was missing `duration`, `category` and `image`. They are
merged here; the legacy routes project out the subset each used to return.

**Capacity is real.** An adventure has `capacity` and `booked` rather than a
one-way `reserved` boolean. Booking is a single conditional update that only
matches while enough seats remain and increments in the same operation — atomic
on one document, so concurrent requests cannot oversell it, with no transaction
required. Cancelling releases the seats.

**Ratings are denormalised** onto the adventure and recomputed from the review
rows after every write, so a card can show stars without a per-card aggregation
and the stored average cannot drift.

## Security

- Passwords hashed with bcrypt (cost 12); the hash is `select: false`, so it
  cannot leak through a stray query.
- JWTs in httpOnly cookies (`SameSite=None; Secure` in production), with a
  bearer-header fallback for curl and Swagger UI.
- Refresh tokens carry a `tokenVersion`; bumping it on the user invalidates
  every token in circulation without a revocation list.
- Login answers identically for a wrong password and an unknown account, so the
  form is not an account-enumeration oracle.
- helmet, a CORS allowlist, and rate limits — tight on auth, moderate on writes.
- Reservations are owned: you can only read and cancel your own.
- Reviews require a confirmed booking for that adventure.
- Unexpected errors are logged server-side and answered with a generic message,
  so stack traces and connection strings never reach a response body.

## API

Full reference at `/api/docs`. In brief:

| Method | Path | |
| --- | --- | --- |
| POST | `/api/v1/auth/register` \| `/login` \| `/refresh` \| `/logout` | |
| GET/PATCH | `/api/v1/auth/me` | |
| POST | `/api/v1/auth/change-password` | |
| GET | `/api/v1/cities` \| `/cities/:id` | |
| GET | `/api/v1/adventures` | filter, search, sort, page, facets |
| GET | `/api/v1/adventures/:id` | |
| GET/POST | `/api/v1/adventures/:id/reviews` | |
| DELETE | `/api/v1/reviews/:id` | |
| GET/POST | `/api/v1/reservations` | auth required |
| POST | `/api/v1/reservations/:id/cancel` | |
| GET | `/api/v1/wishlist` | |
| POST | `/api/v1/wishlist/:adventureId` | toggle |
| GET | `/health` | database connectivity |

### Legacy endpoints

`GET /cities`, `GET /adventures?city=`, `GET /adventures/detail?adventure=`,
`POST /reservations/new`, `GET /reservations` are the pre-MongoDB API, kept
byte-compatible for the deployed client and covered by their own test suite.

One deliberate difference: `GET /reservations` used to return every booking in
the system to anyone who asked. It now returns only the unowned rows from the
original seed data, so the legacy page renders without exposing real customers.

## Testing

```bash
npm test
```

76 tests over six suites, each against a throwaway in-memory MongoDB:

- **auth** — registration, sign-in, cookie flags, enumeration resistance, token rotation
- **adventures** — filtering, sorting, paging, facet counts, regex-safe search
- **reservations** — pricing, capacity, cancellation, ownership, and a
  concurrency test that fires five simultaneous bookings at five seats and
  asserts exactly two succeed
- **reviews** — the booked-first gate, aggregate recomputation, permissions
- **legacy** — payload compatibility with the old lowdb server
- **seed** — the real migration against the real `db.json`
