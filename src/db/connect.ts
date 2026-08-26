import mongoose from "mongoose";
import { env, isProduction } from "../config/env.js";

/**
 * Opens the shared Mongoose connection.
 *
 * `strictQuery` keeps unknown filter keys from being silently dropped, which
 * otherwise turns a typo in a query param into "return everything".
 */
export async function connectToDatabase(uri: string = env.MONGODB_URI): Promise<void> {
  mongoose.set("strictQuery", true);

  if (!isProduction) {
    mongoose.set("debug", false);
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15_000,
    // Atlas' shared tier caps connections; a small pool leaves room for other
    // clients (the seed script, a local shell) without hitting the limit.
    maxPoolSize: 10,
  });
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.connection.close();
}

/** True once the connection is usable — read by the health endpoint. */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
