import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Each file gets its own in-memory mongod, and starting one is not fast.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Suites share collection names, so running files in parallel against the
    // same database would have them deleting each other's fixtures.
    fileParallelism: false,
  },
});
