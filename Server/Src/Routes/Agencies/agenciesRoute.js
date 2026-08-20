import express from "express";
import {
  listAgenciesCtrl,
  createAgencyCtrl,
  updateAgencyCtrl,
  deleteAgencyCtrl,
} from "../../Controllers/Agencies/agenciesController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();

router.use(Verify);

router.get(
  "/",
  RequireAnyPermission(["CREATE_CASES", "UPDATE_CASES", "MANAGE_AGENCIES"]),
  listAgenciesCtrl,
);
router.post("/", RequirePermission("MANAGE_AGENCIES"), createAgencyCtrl);
router.put("/:id", RequirePermission("MANAGE_AGENCIES"), updateAgencyCtrl);
router.delete("/:id", RequirePermission("MANAGE_AGENCIES"), deleteAgencyCtrl);

export default router;
