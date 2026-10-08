/**
 * Runs the API against a disposable in-memory MongoDB, seeded from db.json.
 *
 * Lets the frontend be developed against a real, fully-populated API without an
 * Atlas connection string or a local mongod install. Nothing persists: every
 * restart is a clean, identically-seeded database, which is usually what you
 * want while building UI.
 *
 * Not for production - `npm start` runs the real server.
 */
import { MongoMemoryServer } from "mongodb-memory-server";

async function main(): Promise<void> {
  console.log("[dev] starting an in-memory MongoDB...");
  const mongod = await MongoMemoryServer.create({
    instance: { dbName: "qtrip" },
  });

  // config/env validates on import, so every value must be in place before any
  // application module is loaded - hence the dynamic imports below.
  process.env.MONGODB_URI = mongod.getUri("qtrip");
  process.env.NODE_ENV ??= "development";
  process.env.JWT_ACCESS_SECRET ??= "dev-only-access-secret-not-for-production";
  process.env.JWT_REFRESH_SECRET ??= "dev-only-refresh-secret-not-for-production";

  const { env } = await import("./config/env.js");
  const { connectToDatabase } = await import("./db/connect.js");
  const { seedFromLegacyJson } = await import("./seed/seed.js");
  const { createApp } = await import("./app.js");

  await connectToDatabase();
  await seedFromLegacyJson({ quiet: true, connect: false });
  console.log("[dev] seeded from db.json");

  const server = createApp().listen(env.PORT, () => {
    console.log(`[dev] API      http://localhost:${env.PORT}`);
    console.log(`[dev] docs     http://localhost:${env.PORT}/api/docs`);
    console.log(`[dev] sign in  demo@qtrip.dev / Demo1234`);
    console.log("[dev] in-memory database - nothing is persisted");
    if (!env.SMTP_URL) {
      console.log("[dev] emails   written to .mail-outbox/ (set SMTP_URL to send)");
    }
  });

  const shutdown = async () => {
    server.close();
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  console.error("[dev] failed to start:", err);
  process.exit(1);
});
