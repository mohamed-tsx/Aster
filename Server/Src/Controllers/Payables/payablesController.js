import asyncHandler from "express-async-handler";
import { createPayable, settlePayable, listPayables } from "../../Services/Payables/payablesService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listPayablesCtrl = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const result = await listPayables({ page, limit, status: req.query.status, caseId: req.query.caseId });
  return sendSuccess(res, "Payables retrieved successfully", result);
});
export const createPayableCtrl = asyncHandler(async (req, res) => {
  const payable = await createPayable(req.body, req.user.id);
  return sendCreated(res, "Payable recorded successfully", payable);
});
export const settlePayableCtrl = asyncHandler(async (req, res) => {
  const payable = await settlePayable(req.params.id, req.body, req.user.id);
  return sendSuccess(res, "Payable settled successfully", payable);
});
