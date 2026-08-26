import express from "express";
import {
  searchPatientsCtrl,
  listCasesCtrl,
  getCaseCtrl,
  createCaseCtrl,
  updateCaseCtrl,
  sendInquiryCtrl,
  respondInquiryCtrl,
  cancelCaseCtrl,
  recordFeePaymentCtrl,
  markEmbassyVisitedCtrl,
  recordVisaOutcomeCtrl,
  issueRefundCtrl,
  getCaseTimelineCtrl,
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
router.get("/:id/timeline", RequirePermission("VIEW_CASES"), getCaseTimelineCtrl);
router.post("/", RequirePermission("CREATE_CASES"), createCaseCtrl);
router.put("/:id", RequirePermission("UPDATE_CASES"), updateCaseCtrl);
router.patch("/:id/cancel", RequirePermission("UPDATE_CASES"), cancelCaseCtrl);
router.post("/:id/inquiries", RequirePermission("UPDATE_CASES"), sendInquiryCtrl);
router.patch(
  "/:id/inquiries/:inquiryId",
  RequirePermission("UPDATE_CASES"),
  respondInquiryCtrl,
);
router.post(
  "/:id/visa-applications/:visaApplicationId/fee-payment",
  RequirePermission("MANAGE_FINANCE"),
  recordFeePaymentCtrl,
);
router.patch(
  "/:id/visa-applications/:visaApplicationId/embassy-visit",
  RequirePermission("UPDATE_CASES"),
  markEmbassyVisitedCtrl,
);
router.patch(
  "/:id/visa-applications/:visaApplicationId/outcome",
  RequirePermission("UPDATE_CASES"),
  recordVisaOutcomeCtrl,
);
router.post(
  "/:id/visa-applications/:visaApplicationId/refund",
  RequirePermission("ISSUE_REFUNDS"),
  issueRefundCtrl,
);

export default router;
