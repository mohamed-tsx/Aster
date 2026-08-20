import express from "express";
import {
  listHospitalsCtrl,
  createHospitalCtrl,
  updateHospitalCtrl,
  deleteHospitalCtrl,
} from "../../Controllers/Hospitals/hospitalsController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();

router.use(Verify);

router.get(
  "/",
  RequireAnyPermission(["CREATE_CASES", "UPDATE_CASES", "MANAGE_HOSPITALS"]),
  listHospitalsCtrl,
);
router.post("/", RequirePermission("MANAGE_HOSPITALS"), createHospitalCtrl);
router.put("/:id", RequirePermission("MANAGE_HOSPITALS"), updateHospitalCtrl);
router.delete("/:id", RequirePermission("MANAGE_HOSPITALS"), deleteHospitalCtrl);

export default router;
