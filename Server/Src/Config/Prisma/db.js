import { PrismaClient } from "../../../prisma/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../../");

// Always load env from Server/.env regardless of the current working directory.
dotenv.config({ path: path.join(projectRoot, ".env") });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const Prisma = new PrismaClient({
  adapter,
  transactionOptions: {
    maxWait: 10000, // how long to wait to get a transaction slot (ms)
    timeout: 60000, // how long a transaction can run (ms)
  },
});
export default Prisma;
