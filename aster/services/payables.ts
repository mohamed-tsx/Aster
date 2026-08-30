import api, { getErrorMessage } from "@/utils/api";
import type { Payable, PayableListResult, PayableStatus } from "@/types/payable";

type ApiSuccess<T> = { success: boolean; message: string; data: T };
function unwrap<T>(r: { data: ApiSuccess<T> }): T {
  if (!r.data.success) throw new Error(r.data.message || "Request failed");
  return r.data.data;
}

export async function listPayables(params: { page?: number; limit?: number; status?: PayableStatus; caseId?: string } = {}): Promise<PayableListResult> {
  const r = await api.get<ApiSuccess<PayableListResult>>("/payables", {
    params: { page: params.page ?? 1, limit: params.limit ?? 20, status: params.status || undefined, caseId: params.caseId || undefined },
  });
  return unwrap(r);
}

export type CreatePayablePayload = {
  payeeName: string;
  amount: string;
  currency: "USD" | "INR";
  reason: string;
  raisedOn: string;
  caseId?: string;
};

export async function createPayable(payload: CreatePayablePayload): Promise<Payable> {
  const r = await api.post<ApiSuccess<Payable>>("/payables", payload);
  return unwrap(r);
}

export async function settlePayable(id: string, payload: { accountId: string; paidOn: string }): Promise<Payable> {
  const r = await api.post<ApiSuccess<Payable>>(`/payables/${id}/settle`, payload);
  return unwrap(r);
}

export { getErrorMessage };
