import express from "express";
import { listExpensesCtrl, createExpenseCtrl } from "../../Controllers/Expenses/expensesController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";

const router = express.Router();

router.use(Verify);

router.get("/", RequirePermission("VIEW_FINANCE"), listExpensesCtrl);
router.post("/", RequirePermission("MANAGE_FINANCE"), createExpenseCtrl);

export default router;
