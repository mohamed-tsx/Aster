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
// import authRoutes from "../../Src/Routes/Auth/authRoutes.js";

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
Server.use("/uploads", express.static(path.join(__dirname, "../../uploads/"))); // Serve uploaded files

// Server Routes
// Server.use("/api/v1/auth", authRoutes);

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
