import express from "express";
import {
  listAccountsCtrl,
  createAccountCtrl,
  listAccountTransactionsCtrl,
  listAllAccountTransactionsCtrl,
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
// All transactions across every account — a different path shape
// ("/transactions" vs "/:id/transactions" below) so there's no ambiguity
// with a specific account's ledger.
router.get(
  "/transactions",
  RequireAnyPermission(["MANAGE_ACCOUNTS", "MANAGE_FINANCE", "VIEW_FINANCE"]),
  listAllAccountTransactionsCtrl,
);
router.get(
  "/:id/transactions",
  RequireAnyPermission(["MANAGE_ACCOUNTS", "MANAGE_FINANCE", "VIEW_FINANCE"]),
  listAccountTransactionsCtrl,
);

export default router;
