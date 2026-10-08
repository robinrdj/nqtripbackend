/**
 * Boots a throwaway MongoDB for the suite.
 *
 * Environment variables are set before anything imports `config/env`, which
 * validates them at module load — so this file must not import application code
 * at the top level.
 */
import { afterAll, afterEach, beforeAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer;

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-that-is-long-enough";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-long-enough";
process.env.CORS_ORIGINS = "http://localhost:8081";

// `config/env` validates on import, and the app is imported before `beforeAll`
// runs — so a value has to exist now. Nothing connects with it: the real
// in-memory URI is handed to mongoose directly below.
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/qtrip-test-placeholder";

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
});

afterEach(async () => {
  // A booking queues its email in the background. Let those jobs finish before
  // the wipe, or one would run against an emptied database mid-test - and
  // clear what they sent, so each test sees only its own mail. Imported here,
  // not at the top, for the same env-ordering reason as above.
  const mailer = await import("../src/services/mailer.js");
  await mailer.settleMail();
  mailer.clearSentMail();

  // Wipe rather than drop: dropping would take the indexes with it, and the
  // unique constraints are part of what several tests are asserting on.
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});
