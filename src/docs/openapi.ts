/**
 * OpenAPI description of the v1 surface, served at /api/docs.
 *
 * Written by hand rather than generated from the Zod schemas: the generators
 * available for Zod 4 lag its releases, and a spec that silently drifts from
 * the code is worse than one that is obviously maintained alongside it.
 */
const bearerAuth = [{ bearerAuth: [] }, { cookieAuth: [] }];

const paged = (itemsRef: string) => ({
  type: "object",
  properties: {
    items: { type: "array", items: { $ref: itemsRef } },
    page: { type: "integer", example: 1 },
    limit: { type: "integer", example: 24 },
    total: { type: "integer", example: 71 },
    totalPages: { type: "integer", example: 3 },
  },
});

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "QTrip API",
    version: "3.0.0",
    description:
      "Travel adventure booking API. Browse cities and adventures, filter and " +
      "sort server-side, book seats against real capacity, save favourites and " +
      "leave reviews.\n\n" +
      "**Demo accounts** — `demo@qtrip.dev` / `Demo1234` (traveller), " +
      "`admin@qtrip.dev` / `Admin1234` (admin).\n\n" +
      "**Auth** — sign in via `POST /auth/login`, which sets httpOnly cookies " +
      "and also returns the tokens in the body. Paste the `access` token into " +
      "Authorize below to try the protected routes from here.\n\n" +
      "The unversioned routes (`/cities`, `/adventures`, `/reservations/new`) " +
      "are the pre-MongoDB API, kept working for the deployed client. New work " +
      "should use `/api/v1`.",
  },
  servers: [
    { url: "/api/v1", description: "Current API" },
  ],
  tags: [
    { name: "Auth", description: "Accounts and sessions" },
    { name: "Catalogue", description: "Cities and adventures" },
    { name: "Reservations", description: "Bookings owned by the signed-in user" },
    { name: "Reviews", description: "Ratings, gated on having booked" },
    { name: "Wishlist", description: "Saved adventures" },
    { name: "Tickets", description: "PDF tickets and QR verification" },
    { name: "Live", description: "Server-Sent Events for seat availability" },
    { name: "Weather", description: "Daily forecasts for a trip's city and date" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "qtrip_access" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "NOT_FOUND" },
              message: { type: "string", example: "We could not find that adventure." },
              details: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string", example: "password" },
                    message: { type: "string", example: "Include a number." },
                  },
                },
              },
            },
          },
          message: {
            type: "string",
            description: "Duplicate of error.message, for legacy clients.",
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", example: "Robin Rajadurai" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["user", "admin"] },
          avatarUrl: { type: "string", nullable: true },
        },
      },
      City: {
        type: "object",
        properties: {
          id: { type: "string", example: "manali" },
          city: { type: "string", example: "Manali" },
          description: { type: "string", example: "Himalayan treks, waterfalls and mountain roads" },
          image: { type: "string", format: "uri" },
          photoCredit: { $ref: "#/components/schemas/PhotoCredit" },
          country: { type: "string", example: "India" },
          adventureCount: { type: "integer", example: 8 },
          location: { $ref: "#/components/schemas/Location" },
        },
      },
      Location: {
        type: "object",
        properties: {
          lat: { type: "number", example: 32.24844 },
          lng: { type: "number", example: 77.18084 },
        },
      },
      PhotoCredit: {
        type: "object",
        properties: {
          author: { type: "string" },
          license: { type: "string", example: "CC BY-SA 4.0" },
          source: { type: "string", format: "uri", description: "Wikimedia Commons file page" },
        },
      },
      Adventure: {
        type: "object",
        properties: {
          id: { type: "string", example: "2447910730" },
          city: { type: "string", example: "manali" },
          name: { type: "string", example: "Old Manali Café Night" },
          subtitle: { type: "string" },
          content: { type: "string" },
          image: { type: "string", format: "uri" },
          images: { type: "array", items: { type: "string", format: "uri" } },
          photoCredits: {
            type: "array",
            description: "Attribution for each entry in images, in the same order",
            items: { $ref: "#/components/schemas/PhotoCredit" },
          },
          category: {
            type: "string",
            enum: ["Beaches", "Cycling", "Hillside", "Party"],
          },
          duration: { type: "integer", description: "Hours", example: 6 },
          costPerHead: { type: "integer", example: 1800 },
          currency: { type: "string", example: "INR" },
          capacity: { type: "integer", example: 20 },
          booked: { type: "integer", example: 3 },
          seatsLeft: { type: "integer", example: 17 },
          available: { type: "boolean", description: "Legacy alias for seatsLeft > 0" },
          ratingAverage: { type: "number", example: 4.5 },
          ratingCount: { type: "integer", example: 12 },
          location: {
            $ref: "#/components/schemas/Location",
            description: "Where the adventure starts: trailhead, beach, venue or meeting point",
          },
        },
      },
      Reservation: {
        type: "object",
        properties: {
          id: { type: "string" },
          adventure: { type: "string" },
          adventureName: { type: "string" },
          name: { type: "string" },
          date: { type: "string", format: "date" },
          persons: { type: "integer", example: 2 },
          price: { type: "integer", example: 8006 },
          status: { type: "string", enum: ["confirmed", "cancelled"] },
        },
      },
      Review: {
        type: "object",
        properties: {
          id: { type: "string" },
          adventure: { type: "string" },
          user: { $ref: "#/components/schemas/User" },
          rating: { type: "integer", minimum: 1, maximum: 5 },
          title: { type: "string" },
          body: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
    responses: {
      BadRequest: {
        description: "Validation failed",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Unauthorized: {
        description: "Not signed in",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Forbidden: {
        description: "Signed in, but not allowed",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      NotFound: {
        description: "No such resource",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Conflict: {
        description: "Conflicts with current state (sold out, duplicate)",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Create an account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string", example: "Robin Rajadurai" },
                  email: { type: "string", format: "email" },
                  password: {
                    type: "string",
                    description:
                      "At least 8 characters, with an uppercase letter, a lowercase letter and a number.",
                    example: "Passw0rd!",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Account created; auth cookies set" },
          400: { $ref: "#/components/responses/BadRequest" },
          409: { $ref: "#/components/responses/Conflict" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Sign in",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", example: "demo@qtrip.dev" },
                  password: { type: "string", example: "Demo1234" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Signed in; auth cookies set" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Exchange the refresh cookie for a new token pair",
        responses: {
          200: { description: "New tokens issued" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Clear the auth cookies",
        responses: { 200: { description: "Signed out" } },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "The signed-in user",
        security: bearerAuth,
        responses: {
          200: {
            description: "Current user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/User" } },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      patch: {
        tags: ["Auth"],
        summary: "Update your name or avatar",
        security: bearerAuth,
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  avatarUrl: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Change your password",
        description: "Signs out every other device by bumping the token version.",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: { type: "string" },
                  newPassword: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Changed; this device re-authenticated" },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/cities": {
      get: {
        tags: ["Catalogue"],
        summary: "All cities",
        responses: {
          200: {
            description: "Cities",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/City" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/cities/{id}": {
      get: {
        tags: ["Catalogue"],
        summary: "One city",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "manali",
          },
        ],
        responses: {
          200: { description: "City" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/adventures": {
      get: {
        tags: ["Catalogue"],
        summary: "Search, filter, sort and page adventures",
        description:
          "All filtering happens in the database. The response carries facet " +
          "counts computed without the category filter applied, so the UI can " +
          "show how many results each unticked option would add.",
        parameters: [
          { name: "city", in: "query", schema: { type: "string" }, example: "manali" },
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "Partial match against name and subtitle.",
          },
          {
            name: "category",
            in: "query",
            schema: { type: "string" },
            description: "Comma-separated, e.g. `Beaches,Party`.",
          },
          { name: "durationMin", in: "query", schema: { type: "number" } },
          { name: "durationMax", in: "query", schema: { type: "number" } },
          { name: "priceMin", in: "query", schema: { type: "number" } },
          { name: "priceMax", in: "query", schema: { type: "number" } },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "recommended",
                "price-asc",
                "price-desc",
                "duration-asc",
                "duration-desc",
                "rating",
              ],
            },
          },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 60 },
          },
        ],
        responses: {
          200: {
            description: "A page of adventures, plus facets",
            content: {
              "application/json": {
                schema: paged("#/components/schemas/Adventure"),
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/adventures/{id}": {
      get: {
        tags: ["Catalogue"],
        summary: "One adventure",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Adventure, and whether the caller saved it" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/adventures/{id}/reviews": {
      get: {
        tags: ["Reviews"],
        summary: "Reviews for an adventure",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          {
            name: "sort",
            in: "query",
            schema: { type: "string", enum: ["newest", "highest", "lowest"] },
          },
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          200: {
            description: "Reviews, with a five-bucket rating distribution",
            content: {
              "application/json": { schema: paged("#/components/schemas/Review") },
            },
          },
        },
      },
      post: {
        tags: ["Reviews"],
        summary: "Write or replace your review",
        description:
          "Only available to someone with a confirmed booking for this " +
          "adventure. Posting a second time replaces the first review rather " +
          "than adding another.",
        security: bearerAuth,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["rating", "body"],
                properties: {
                  rating: { type: "integer", minimum: 1, maximum: 5 },
                  title: { type: "string" },
                  body: { type: "string", minLength: 10 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Review saved" },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/reviews/{id}": {
      delete: {
        tags: ["Reviews"],
        summary: "Delete a review",
        description: "The author, or an admin.",
        security: bearerAuth,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          204: { description: "Deleted" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/reservations": {
      get: {
        tags: ["Reservations"],
        summary: "Your bookings",
        security: bearerAuth,
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["confirmed", "cancelled", "all"] },
          },
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          200: {
            description: "A page of your bookings",
            content: {
              "application/json": {
                schema: paged("#/components/schemas/Reservation"),
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Reservations"],
        summary: "Book seats",
        description:
          "Claims seats atomically against the adventure's remaining capacity, " +
          "so concurrent requests cannot oversell it.",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["adventure", "name", "date", "persons"],
                properties: {
                  adventure: { type: "string", example: "2447910730" },
                  name: { type: "string", example: "Robin Rajadurai" },
                  date: { type: "string", format: "date", example: "2026-12-01" },
                  persons: { type: "integer", minimum: 1, maximum: 20 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Booked" },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          409: { $ref: "#/components/responses/Conflict" },
        },
      },
    },
    "/reservations/{id}/cancel": {
      post: {
        tags: ["Reservations"],
        summary: "Cancel a booking and release its seats",
        security: bearerAuth,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Cancelled" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          409: { $ref: "#/components/responses/Conflict" },
        },
      },
    },
    "/wishlist": {
      get: {
        tags: ["Wishlist"],
        summary: "Your saved adventures",
        security: bearerAuth,
        responses: {
          200: { description: "Saved adventures, newest first" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/wishlist/{adventureId}": {
      post: {
        tags: ["Wishlist"],
        summary: "Save or unsave an adventure",
        description: "Returns the resulting state, so an optimistic UI can reconcile.",
        security: bearerAuth,
        parameters: [
          {
            name: "adventureId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "New state",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { saved: { type: "boolean" } },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/auth/providers": {
      get: {
        tags: ["Auth"],
        summary: "Which sign-in methods are enabled",
        responses: {
          200: {
            description: "Password is always on; Google when GOOGLE_CLIENT_ID is set",
            content: {
              "application/json": {
                example: {
                  password: true,
                  google: { enabled: true, clientId: "123-abc.apps.googleusercontent.com" },
                },
              },
            },
          },
        },
      },
    },
    "/auth/google": {
      post: {
        tags: ["Auth"],
        summary: "Sign in with a Google ID token",
        description:
          "Takes the `credential` from Google Identity Services. Creates the " +
          "account on first use, or links an existing one with the same " +
          "verified email. Sets the same cookies as password sign-in.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["credential"],
                properties: { credential: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Signed in" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { description: "Google sign-in is not enabled on this server" },
        },
      },
    },
    "/reservations/{id}/ticket": {
      get: {
        tags: ["Tickets"],
        summary: "Download the ticket for one of your bookings",
        security: bearerAuth,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "A PDF ticket with a signed QR code",
            content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          409: { $ref: "#/components/responses/Conflict" },
        },
      },
    },
    "/tickets/{id}/verify": {
      get: {
        tags: ["Tickets"],
        summary: "Check a scanned ticket",
        description:
          "Public. The `sig` from the QR code authorises the lookup; a wrong " +
          "signature and an unknown id get the same `{ valid: false }`.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "sig", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Verdict",
            content: {
              "application/json": {
                example: {
                  valid: true,
                  reference: "QT-3F9A21C4",
                  status: "confirmed",
                  adventureName: "Old Manali Café Night",
                  city: "manali",
                  date: "2026-12-01",
                  persons: 2,
                  guest: "Robin R.",
                },
              },
            },
          },
        },
      },
    },
    "/adventures/{id}/live": {
      get: {
        tags: ["Live"],
        summary: "Stream seat availability and viewer counts",
        description:
          "A `text/event-stream`. Emits `seats` ({ adventureId, capacity, " +
          "booked, seatsLeft }) on connect and after every booking or " +
          "cancellation, and `viewers` ({ adventureId, count }) as people " +
          "open and close the page. Swagger UI cannot display a stream; try " +
          "`curl -N` instead.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Event stream", content: { "text/event-stream": {} } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/weather": {
      get: {
        tags: ["Weather"],
        summary: "Daily forecast for a city on a date",
        description:
          "Backed by Open-Meteo, cached per city for an hour. Covers the next " +
          "16 days; outside that, or if the upstream is down, answers " +
          "`available: false` with a reason rather than an error.",
        parameters: [
          { name: "city", in: "query", required: true, schema: { type: "string" }, example: "goa" },
          {
            name: "date",
            in: "query",
            required: true,
            schema: { type: "string", format: "date" },
          },
        ],
        responses: {
          200: {
            description: "Forecast, or why there is none",
            content: {
              "application/json": {
                example: {
                  forecast: {
                    available: true,
                    date: "2026-10-02",
                    condition: "rain",
                    summary: "Rain showers",
                    tempMax: 31,
                    tempMin: 24,
                    precipitationChance: 70,
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
  },
} as const;
