import express from "express";
import { getSettingsCtrl, updateSettingsCtrl } from "../../Controllers/Settings/settingsController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";

const router = express.Router();

router.use(Verify);

// Any logged-in user may read settings (the fee dialog prefills from them).
router.get("/", getSettingsCtrl);
router.put("/", RequirePermission("MANAGE_SETTINGS"), updateSettingsCtrl);

export default router;
