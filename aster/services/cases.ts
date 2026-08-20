import api, { getErrorMessage } from "@/utils/api";
import type { Case, CaseListItem, CasesListResult } from "@/types/case";
import type { Patient } from "@/types/patient";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export type ListCasesParams = {
  page?: number;
  limit?: number;
  status?: string;
  reachOutType?: string;
  assignedToId?: string;
  q?: string;
};

export async function listCases(
  params: ListCasesParams = {},
): Promise<CasesListResult> {
  const response = await api.get<ApiSuccess<CasesListResult>>("/cases", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      status: params.status || undefined,
      reachOutType: params.reachOutType || undefined,
      assignedToId: params.assignedToId || undefined,
      q: params.q || undefined,
    },
  });
  return unwrap(response);
}

export async function getCaseById(id: string): Promise<Case> {
  const response = await api.get<ApiSuccess<Case>>(`/cases/${id}`);
  return unwrap(response);
}

export async function searchPatients(passportNumber: string): Promise<Patient[]> {
  const response = await api.get<ApiSuccess<{ patients: Patient[] }>>(
    "/cases/patients/search",
    { params: { passportNumber } },
  );
  return unwrap(response).patients;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createCase(payload: Record<string, any>): Promise<Case> {
  const response = await api.post<ApiSuccess<Case>>("/cases", payload);
  return unwrap(response);
}

export async function updateCase(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
): Promise<Case> {
  const response = await api.put<ApiSuccess<Case>>(`/cases/${id}`, payload);
  return unwrap(response);
}

export async function cancelCase(id: string): Promise<Case> {
  const response = await api.patch<ApiSuccess<Case>>(`/cases/${id}/cancel`);
  return unwrap(response);
}

export async function sendInquiry(
  caseId: string,
  payload: { hospitalId: string; notes?: string },
): Promise<Case> {
  const response = await api.post<ApiSuccess<Case>>(
    `/cases/${caseId}/inquiries`,
    payload,
  );
  return unwrap(response);
}

export async function respondToInquiry(
  caseId: string,
  inquiryId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
): Promise<Case> {
  const response = await api.patch<ApiSuccess<Case>>(
    `/cases/${caseId}/inquiries/${inquiryId}`,
    payload,
  );
  return unwrap(response);
}

export { getErrorMessage };
export type { CaseListItem };
