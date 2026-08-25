import multer from "multer";

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
    cb(ok ? null : new Error("Only JPG/PNG/WEBP/PDF/DOC/DOCX files are allowed"), ok);
  },
});
