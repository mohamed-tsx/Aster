import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup/env.js", "./tests/setup/db-reset.js"],
    // Real Postgres round-trips per test are slower than mocked unit tests.
    testTimeout: 20000,
    hookTimeout: 20000,
    // Table TRUNCATE in the shared beforeEach isn't safe under file-level
    // parallelism — force test files to run one at a time.
    fileParallelism: false,
  },
});
