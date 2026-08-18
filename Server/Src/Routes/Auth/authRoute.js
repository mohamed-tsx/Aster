import express from "express";
import {
  loginCtrl,
  logoutCtrl,
  refreshTokenCtrl,
  getMeCtrl,
  changePasswordCtrl,
  updateProfileCtrl,
} from "../../Controllers/Auth/authController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import { uploadUserAvatar } from "../../Middlewares/Multer/uploadUserAvatar.js";

const router = express.Router();

// Public routes
router.post("/login", loginCtrl);
router.post("/refresh", refreshTokenCtrl);
router.post("/logout", logoutCtrl);

// Protected routes (require authentication)
router.get("/me", Verify, getMeCtrl);
router.put("/change-password", Verify, changePasswordCtrl);
router.put(
  "/profile",
  Verify,
  uploadUserAvatar.single("avatar"),
  updateProfileCtrl,
);

export default router;
