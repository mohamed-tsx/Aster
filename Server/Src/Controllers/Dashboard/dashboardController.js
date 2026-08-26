import asyncHandler from "express-async-handler";
import {
  getCaseStats,
  getFinanceStats,
  getRecentActivity,
} from "../../Services/Dashboard/dashboardService.js";
import { sendSuccess } from "../../Utils/Response/apiResponse.js";

export const getCaseStatsCtrl = asyncHandler(async (req, res) => {
  const stats = await getCaseStats();
  return sendSuccess(res, "Case stats retrieved successfully", stats);
});

export const getFinanceStatsCtrl = asyncHandler(async (req, res) => {
  const stats = await getFinanceStats();
  return sendSuccess(res, "Finance stats retrieved successfully", stats);
});

const FINANCE_ACTIVITY_TYPES = new Set(["PAYMENT_RECEIVED", "EXPENSE_PAID", "REFUND_ISSUED"]);

export const getRecentActivityCtrl = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
  let activity = await getRecentActivity(limit);

  // This endpoint only requires VIEW_CASES to keep the case/document timeline
  // visible broadly — but the finance events it merges in (payments, expenses,
  // refunds) carry amounts, so those are dropped for anyone without VIEW_FINANCE
  // too, rather than gating the whole endpoint on it.
  const permissions = req.user?.role?.permissions ?? [];
  const canViewFinance = permissions.some((p) => p.name === "VIEW_FINANCE");
  if (!canViewFinance) {
    activity = activity.filter((item) => !FINANCE_ACTIVITY_TYPES.has(item.type));
  }

  return sendSuccess(res, "Recent activity retrieved successfully", { activity });
});
