import express from "express";
import {
  searchPatientsCtrl,
  listCasesCtrl,
  getCaseCtrl,
  createCaseCtrl,
  updateCaseCtrl,
} from "../../Controllers/Cases/casesController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();

router.use(Verify);

// Registered before "/:id" so "patients" is never matched as a case id.
router.get(
  "/patients/search",
  RequireAnyPermission(["CREATE_CASES", "UPDATE_CASES"]),
  searchPatientsCtrl,
);

router.get("/", RequirePermission("VIEW_CASES"), listCasesCtrl);
router.get("/:id", RequirePermission("VIEW_CASES"), getCaseCtrl);
router.post("/", RequirePermission("CREATE_CASES"), createCaseCtrl);
router.put("/:id", RequirePermission("UPDATE_CASES"), updateCaseCtrl);

export default router;
