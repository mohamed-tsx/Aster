import asyncHandler from "express-async-handler";
import { createRevenue, listRevenue } from "../../Services/Revenue/revenueService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listRevenueCtrl = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const result = await listRevenue({ page, limit, caseId: req.query.caseId, category: req.query.category });
  return sendSuccess(res, "Revenue retrieved successfully", result);
});

export const createRevenueCtrl = asyncHandler(async (req, res) => {
  const revenue = await createRevenue(req.body, req.user.id);
  return sendCreated(res, "Revenue recorded successfully", revenue);
});
