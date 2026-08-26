import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectToDatabase, disconnectFromDatabase } from "./db/connect.js";

async function main(): Promise<void> {
  // Connect before listening, so the process never accepts a request it cannot
  // serve - a container orchestrator sees a clean failure instead of a stream
  // of 500s from a half-started server.
  await connectToDatabase();
  console.log("[db] connected");

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT}`);
    console.log(`[api] docs at http://localhost:${env.PORT}/api/docs`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectFromDatabase();
      process.exit(0);
    });
    // Do not let a hung connection hold the process open forever.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[api] failed to start:", err);
  process.exit(1);
});
