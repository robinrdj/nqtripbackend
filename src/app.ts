import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env, isTest } from "./config/env.js";
import { attachUser } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { isDatabaseConnected } from "./db/connect.js";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./docs/openapi.js";
import apiRoutes from "./routes/index.js";
import legacyRoutes from "./routes/legacy.js";

export function createApp(): Express {
  const app = express();

  // Render and Netlify sit behind a proxy; without this the rate limiter keys
  // every request to the proxy's IP and throttles all users as though they were
  // one, and `secure` cookies are not recognised as such.
  app.set("trust proxy", 1);

  app.use(helmet());

  app.use(
    cors({
      // Credentialed requests cannot use a wildcard origin, so echo back only
      // origins on the allowlist. A request with no Origin (curl, server-side)
      // is allowed through.
      origin(origin, callback) {
        if (!origin || env.CORS_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));
  app.use(cookieParser());

  if (!isTest) {
    app.use(morgan("dev"));
  }

  app.use(generalLimiter);

  // Runs before every route so handlers can read `req.user` when a session
  // exists, without each route having to opt in.
  app.use(attachUser);

  app.get("/health", (_req, res) => {
    const dbUp = isDatabaseConnected();
    res.status(dbUp ? 200 : 503).json({
      status: dbUp ? "ok" : "degraded",
      database: dbUp ? "connected" : "disconnected",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/", (_req, res) => {
    res.json({
      name: "QTrip API",
      version: "3.0.0",
      docs: "/api/docs",
      health: "/health",
    });
  });

  // Swagger UI loads its own inline styles and scripts, which helmet's default
  // CSP blocks - so the docs route opts out of that one header.
  app.use(
    "/api/docs",
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "QTrip API",
      swaggerOptions: { persistAuthorization: true },
    })
  );

  app.get("/api/openapi.json", (_req, res) => res.json(openApiDocument));

  app.use("/api/v1", apiRoutes);

  // Mounted last at the root so the legacy paths cannot shadow anything above.
  app.use("/", legacyRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
