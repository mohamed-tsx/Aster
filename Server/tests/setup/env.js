// Must run BEFORE any test file (or setup file) imports Src/Config/Prisma/db.js,
// since that module reads process.env.DATABASE_URL at import time. Listed first
// in vitest.config.js's `setupFiles` so this executes before db-reset.js.
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.test"), override: true });

// db.js's own dotenv.config() call (no override) will no-op once DATABASE_URL is
// already set, but guard anyway so a missing/misconfigured .env.test can never
// let tests run against the real dev database.
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes("_test")) {
  throw new Error(
    "Refusing to run tests: DATABASE_URL does not point at a *_test database. " +
      "Check Server/.env.test.",
  );
}
