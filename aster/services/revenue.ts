import api, { getErrorMessage } from "@/utils/api";
import type { Revenue, RevenueListResult, RevenueCategory } from "@/types/revenue";

type ApiSuccess<T> = { success: boolean; message: string; data: T };
function unwrap<T>(r: { data: ApiSuccess<T> }): T {
  if (!r.data.success) throw new Error(r.data.message || "Request failed");
  return r.data.data;
}

export async function listRevenue(params: { page?: number; limit?: number; caseId?: string; category?: RevenueCategory } = {}): Promise<RevenueListResult> {
  const r = await api.get<ApiSuccess<RevenueListResult>>("/revenue", {
    params: { page: params.page ?? 1, limit: params.limit ?? 20, caseId: params.caseId || undefined, category: params.category || undefined },
  });
  return unwrap(r);
}

export type CreateRevenuePayload = {
  category: RevenueCategory;
  amount: string;
  currency: "USD" | "INR";
  accountId: string;
  receivedOn: string;
  caseId?: string;
  description?: string;
};

export async function createRevenue(payload: CreateRevenuePayload): Promise<Revenue> {
  const r = await api.post<ApiSuccess<Revenue>>("/revenue", payload);
  return unwrap(r);
}

export { getErrorMessage };
