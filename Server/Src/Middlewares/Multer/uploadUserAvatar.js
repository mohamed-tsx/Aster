import multer from "multer";

const storage = multer.memoryStorage();

export const uploadUserAvatar = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpe?g|png|webp)$/i.test(file.mimetype);
    cb(ok ? null : new Error("Only JPG/PNG/WEBP images are allowed"), ok);
  },
});

// Legacy export for backwards compatibility
export const uploadAvatar = uploadUserAvatar.single("avatar");
