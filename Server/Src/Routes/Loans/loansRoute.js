import express from "express";
import { listLoansCtrl, getLoanCtrl, createLoanCtrl, recordLoanRepaymentCtrl } from "../../Controllers/Loans/loansController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();
router.use(Verify);
const READ = RequireAnyPermission(["VIEW_FINANCE", "MANAGE_LOANS"]);
router.get("/", READ, listLoansCtrl);
router.get("/:id", READ, getLoanCtrl);
router.post("/", RequirePermission("MANAGE_LOANS"), createLoanCtrl);
router.post("/:id/repayments", RequirePermission("MANAGE_LOANS"), recordLoanRepaymentCtrl);
export default router;
