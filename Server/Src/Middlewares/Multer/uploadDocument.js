import multer from "multer";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED_MIME_TYPES.has(file.mimetype);
    if (!ok) {
      cb(
        new AppError(
          "Only JPG, PNG, WEBP, PDF, DOC, and DOCX files are allowed",
          400,
          "VALIDATION_ERROR",
        ),
      );
      return;
    }
    cb(null, true);
  },
});
