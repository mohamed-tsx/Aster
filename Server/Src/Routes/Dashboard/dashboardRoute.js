import express from "express";
import {
  getCaseStatsCtrl,
  getFinanceStatsCtrl,
  getRecentActivityCtrl,
} from "../../Controllers/Dashboard/dashboardController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";

const router = express.Router();

router.use(Verify);

router.get("/case-stats", RequirePermission("VIEW_CASES"), getCaseStatsCtrl);
router.get("/finance-stats", RequirePermission("VIEW_FINANCE"), getFinanceStatsCtrl);
router.get("/recent-activity", RequirePermission("VIEW_CASES"), getRecentActivityCtrl);

export default router;
