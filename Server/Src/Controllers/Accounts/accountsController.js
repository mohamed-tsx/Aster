import asyncHandler from "express-async-handler";
import {
  listAccounts,
  createAccount,
  listAccountTransactions,
} from "../../Services/Accounts/accountsService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listAccountsCtrl = asyncHandler(async (req, res) => {
  const accounts = await listAccounts();
  return sendSuccess(res, "Accounts retrieved successfully", { accounts });
});

export const createAccountCtrl = asyncHandler(async (req, res) => {
  const account = await createAccount(req.body, req.user.id);
  return sendCreated(res, "Account created successfully", account);
});

export const listAccountTransactionsCtrl = asyncHandler(async (req, res) => {
  const rawPage = parseInt(req.query.page, 10) || 1;
  const rawLimit = parseInt(req.query.limit, 10) || 20;
  const page = Math.max(1, rawPage);
  const limit = Math.min(100, Math.max(1, rawLimit));

  const result = await listAccountTransactions(req.params.id, { page, limit });
  return sendSuccess(res, "Account transactions retrieved successfully", result);
});
