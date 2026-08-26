import asyncHandler from "express-async-handler";
import { listExpenses, createExpense } from "../../Services/Expenses/expensesService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listExpensesCtrl = asyncHandler(async (req, res) => {
  const rawPage = parseInt(req.query.page, 10) || 1;
  const rawLimit = parseInt(req.query.limit, 10) || 20;
  const page = Math.max(1, rawPage);
  const limit = Math.min(100, Math.max(1, rawLimit));

  const result = await listExpenses({ page, limit, caseId: req.query.caseId });
  return sendSuccess(res, "Expenses retrieved successfully", result);
});

export const createExpenseCtrl = asyncHandler(async (req, res) => {
  const expense = await createExpense(req.body, req.user.id);
  return sendCreated(res, "Expense recorded successfully", expense);
});
