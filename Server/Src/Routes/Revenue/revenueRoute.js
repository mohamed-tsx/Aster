import express from "express";
import { listRevenueCtrl, createRevenueCtrl } from "../../Controllers/Revenue/revenueController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();

router.use(Verify);

router.get("/", RequireAnyPermission(["VIEW_FINANCE", "MANAGE_REVENUE"]), listRevenueCtrl);
router.post("/", RequirePermission("MANAGE_REVENUE"), createRevenueCtrl);

export default router;
