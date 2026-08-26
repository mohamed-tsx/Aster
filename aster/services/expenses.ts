import api, { getErrorMessage } from "@/utils/api";
import type { Expense, ExpensesListResult } from "@/types/expense";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export type ListExpensesParams = {
  page?: number;
  limit?: number;
  caseId?: string;
};

export async function listExpenses(
  params: ListExpensesParams = {},
): Promise<ExpensesListResult> {
  const response = await api.get<ApiSuccess<ExpensesListResult>>("/expenses", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      caseId: params.caseId || undefined,
    },
  });
  return unwrap(response);
}

export type CreateExpensePayload = {
  caseId?: string;
  visaApplicationId?: string;
  category: string;
  amount: string;
  currency: "USD" | "INR";
  accountId: string;
  notes?: string;
};

export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  const response = await api.post<ApiSuccess<Expense>>("/expenses", payload);
  return unwrap(response);
}

export { getErrorMessage };
