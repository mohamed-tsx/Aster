import express from "express";
import { listPayablesCtrl, createPayableCtrl, settlePayableCtrl } from "../../Controllers/Payables/payablesController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();
router.use(Verify);
router.get("/", RequireAnyPermission(["VIEW_FINANCE", "MANAGE_PAYABLES"]), listPayablesCtrl);
router.post("/", RequirePermission("MANAGE_PAYABLES"), createPayableCtrl);
router.post("/:id/settle", RequirePermission("MANAGE_PAYABLES"), settlePayableCtrl);
export default router;
