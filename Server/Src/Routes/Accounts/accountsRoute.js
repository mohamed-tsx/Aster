import express from "express";
import {
  listAccountsCtrl,
  createAccountCtrl,
  listAccountTransactionsCtrl,
} from "../../Controllers/Accounts/accountsController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();

router.use(Verify);

router.get(
  "/",
  RequireAnyPermission(["MANAGE_ACCOUNTS", "MANAGE_FINANCE"]),
  listAccountsCtrl,
);
router.post("/", RequirePermission("MANAGE_ACCOUNTS"), createAccountCtrl);
router.get(
  "/:id/transactions",
  RequireAnyPermission(["MANAGE_ACCOUNTS", "MANAGE_FINANCE", "VIEW_FINANCE"]),
  listAccountTransactionsCtrl,
);

export default router;
