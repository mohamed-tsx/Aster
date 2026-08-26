import { beforeEach } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";

// Order doesn't matter — CASCADE handles FK dependents (including Prisma's
// implicit Role<->Permission join table).
const TABLES = [
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
];

beforeEach(async () => {
  const quoted = TABLES.map((t) => `"${t}"`).join(", ");
  await Prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
});
