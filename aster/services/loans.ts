import api, { getErrorMessage } from "@/utils/api";
import type { Loan, LoanListResult, LoanRepayment, LoanInterestMethod, LoanStatus } from "@/types/loan";

type ApiSuccess<T> = { success: boolean; message: string; data: T };
function unwrap<T>(r: { data: ApiSuccess<T> }): T {
  if (!r.data.success) throw new Error(r.data.message || "Request failed");
  return r.data.data;
}

export async function listLoans(params: { page?: number; limit?: number; status?: LoanStatus } = {}): Promise<LoanListResult> {
  const r = await api.get<ApiSuccess<LoanListResult>>("/loans", {
    params: { page: params.page ?? 1, limit: params.limit ?? 20, status: params.status || undefined },
  });
  return unwrap(r);
}

export async function getLoan(id: string): Promise<Loan> {
  const r = await api.get<ApiSuccess<Loan>>(`/loans/${id}`);
  return unwrap(r);
}

export type CreateLoanPayload = {
  lenderName: string;
  principal: string;
  currency: "USD" | "INR";
  interestRatePct: string;
  interestMethod: LoanInterestMethod;
  disbursedOn: string;
  termMonths: number;
  accountId: string;
  notes?: string;
};

export async function createLoan(payload: CreateLoanPayload): Promise<Loan> {
  const r = await api.post<ApiSuccess<Loan>>("/loans", payload);
  return unwrap(r);
}

export async function recordLoanRepayment(loanId: string, payload: { amount: string; paidOn: string; accountId: string }): Promise<LoanRepayment> {
  const r = await api.post<ApiSuccess<LoanRepayment>>(`/loans/${loanId}/repayments`, payload);
  return unwrap(r);
}

export { getErrorMessage };
