import asyncHandler from "express-async-handler";
import { createLoan, recordLoanRepayment, listLoans, getLoanById } from "../../Services/Loans/loansService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

const paging = (req) => ({
  page: Math.max(1, parseInt(req.query.page, 10) || 1),
  limit: Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20)),
});

export const listLoansCtrl = asyncHandler(async (req, res) => {
  const result = await listLoans({ ...paging(req), status: req.query.status });
  return sendSuccess(res, "Loans retrieved successfully", result);
});
export const getLoanCtrl = asyncHandler(async (req, res) => {
  const loan = await getLoanById(req.params.id);
  return sendSuccess(res, "Loan retrieved successfully", loan);
});
export const createLoanCtrl = asyncHandler(async (req, res) => {
  const loan = await createLoan(req.body, req.user.id);
  return sendCreated(res, "Loan recorded successfully", loan);
});
export const recordLoanRepaymentCtrl = asyncHandler(async (req, res) => {
  const repayment = await recordLoanRepayment(req.params.id, req.body, req.user.id);
  return sendCreated(res, "Repayment recorded successfully", repayment);
});
