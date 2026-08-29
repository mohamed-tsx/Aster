import { beforeEach, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import Prisma from "../../Src/Config/Prisma/db.js";

// Order doesn't matter — CASCADE handles FK dependents (including Prisma's
// implicit Role<->Permission join table).
const TABLES = [
  "CaseEvent",
  "CaseNote",
  "AccountTransaction",
  "Refund",
  "Expense",
  "Payment",
  "Document",
  "VisaApplication",
  "HospitalInquiry",
  "Attendant",
  "Case",
  "Patient",
  "Agency",
  "Hospital",
  "Account",
  "User",
  "Role",
  "Permission",
  "AppSetting",
];

beforeEach(async () => {
  const quoted = TABLES.map((t) => `"${t}"`).join(", ");
  await Prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
});

afterAll(async () => {
  await fs.rm(path.join(process.cwd(), "uploads", "documents"), {
    recursive: true,
    force: true,
  });
});
