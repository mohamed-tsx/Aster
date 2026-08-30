import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from "../../Src/Routes/Auth/authRoute.js";
import usersRoutes from "../../Src/Routes/Users/usersRoute.js";
import rolesRoutes from "../../Src/Routes/Roles/rolesRoute.js";
import permissionsRoutes from "../../Src/Routes/Permissions/permissionsRoute.js";
import hospitalsRoutes from "../../Src/Routes/Hospitals/hospitalsRoute.js";
import agenciesRoutes from "../../Src/Routes/Agencies/agenciesRoute.js";
import casesRoutes from "../../Src/Routes/Cases/casesRoute.js";
import documentsRoutes from "../../Src/Routes/Documents/documentsRoute.js";
import caseNotesRoutes from "../../Src/Routes/CaseNotes/caseNotesRoute.js";
import accountsRoutes from "../../Src/Routes/Accounts/accountsRoute.js";
import expensesRoutes from "../../Src/Routes/Expenses/expensesRoute.js";
import dashboardRoutes from "../../Src/Routes/Dashboard/dashboardRoute.js";
import settingsRoutes from "../../Src/Routes/Settings/settingsRoute.js";
import Verify from "../../Src/Middlewares/Auth/Verify.js";
import RequirePermission from "../../Src/Middlewares/Auth/RequirePermission.js";

// Import enhanced error handler middleware
import {
  notFound,
  errorHandler,
} from "../../Src/Utils/ErrorHandler/errorHandler.js";

// Load environment variables
dotenv.config();

const Server = express();
Server.set("trust proxy", true);

const parseEnvInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const apiLimiter = rateLimit({
  windowMs: parseEnvInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: parseEnvInt(process.env.RATE_LIMIT_MAX, 500),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: parseEnvInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: parseEnvInt(process.env.AUTH_RATE_LIMIT_MAX, 25),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
});

// Middleware
// Parse CORS origins from environment variable (comma-separated)
const allowedOrigins = process.env.CORS_ORIGIN;

Server.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (e.g., mobile apps, curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // allow cookies / auth headers
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
Server.use(express.urlencoded({ extended: false })); // Parse URL Encoded requests with size limit
Server.use(express.json());
Server.use(cookieParser()); // Handle cookies
Server.use("/api/v1", apiLimiter);
Server.use("/api/v1/auth", authLimiter);
// Case documents (passport scans, visa copies, etc.) are sensitive — beyond being
// logged in, a requester must hold VIEW_CASES to fetch them. This more-specific
// route is mounted before the generic "/uploads" route below so it takes
// precedence for document requests (Express matches middleware in registration
// order, and express.static ends the response once it finds a file); avatar
// requests and anything else under "/uploads" still fall through to the generic
// route.
Server.use(
  "/uploads/documents",
  Verify,
  RequirePermission("VIEW_CASES"),
  express.static(path.join(__dirname, "../../uploads/documents/")),
);
Server.use(
  "/uploads",
  Verify,
  express.static(path.join(__dirname, "../../uploads/")),
); // Serve uploaded files (requires login)

// Server Routes
Server.use("/api/v1/auth", authRoutes);
Server.use("/api/v1/users", usersRoutes);
Server.use("/api/v1/roles", rolesRoutes);
Server.use("/api/v1/permissions", permissionsRoutes);
Server.use("/api/v1/hospitals", hospitalsRoutes);
Server.use("/api/v1/agencies", agenciesRoutes);
Server.use("/api/v1/cases", casesRoutes);
Server.use("/api/v1/cases/:caseId/documents", documentsRoutes);
Server.use("/api/v1/cases/:caseId/notes", caseNotesRoutes);
Server.use("/api/v1/accounts", accountsRoutes);
Server.use("/api/v1/expenses", expensesRoutes);
Server.use("/api/v1/dashboard", dashboardRoutes);
Server.use("/api/v1/settings", settingsRoutes);

// Default route
Server.get("/", (req, res) => {
  res.send("API is running...");
});

// 404 handler
Server.use(notFound);

// Global error handler
Server.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
Server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
