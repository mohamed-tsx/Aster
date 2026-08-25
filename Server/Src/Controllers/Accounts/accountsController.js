import asyncHandler from "express-async-handler";
import { listAccounts, createAccount } from "../../Services/Accounts/accountsService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listAccountsCtrl = asyncHandler(async (req, res) => {
  const accounts = await listAccounts();
  return sendSuccess(res, "Accounts retrieved successfully", { accounts });
});

export const createAccountCtrl = asyncHandler(async (req, res) => {
  const account = await createAccount(req.body, req.user.id);
  return sendCreated(res, "Account created successfully", account);
});
