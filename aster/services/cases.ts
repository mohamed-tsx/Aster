import api, { getErrorMessage } from "@/utils/api";
import type { Case, CaseListItem, CasesListResult, HospitalInquiry } from "@/types/case";
import type { PatientSummary } from "@/types/patient";
import type { VisaApplication } from "@/types/visa";

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

export async function searchPatients(passportNumber: string): Promise<PatientSummary[]> {
  const response = await api.get<ApiSuccess<{ patients: PatientSummary[] }>>(
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
): Promise<HospitalInquiry> {
  const response = await api.post<ApiSuccess<HospitalInquiry>>(
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
): Promise<HospitalInquiry> {
  const response = await api.patch<ApiSuccess<HospitalInquiry>>(
    `/cases/${caseId}/inquiries/${inquiryId}`,
    payload,
  );
  return unwrap(response);
}

export async function recordFeePayment(
  caseId: string,
  visaApplicationId: string,
  payload: { accountId: string; amount: string; notes?: string },
): Promise<VisaApplication> {
  const response = await api.post<ApiSuccess<VisaApplication>>(
    `/cases/${caseId}/visa-applications/${visaApplicationId}/fee-payment`,
    payload,
  );
  return unwrap(response);
}

export async function markEmbassyVisited(
  caseId: string,
  visaApplicationId: string,
  payload: { embassyVisitDate: string; notes?: string },
): Promise<VisaApplication> {
  const response = await api.patch<ApiSuccess<VisaApplication>>(
    `/cases/${caseId}/visa-applications/${visaApplicationId}/embassy-visit`,
    payload,
  );
  return unwrap(response);
}

export async function recordVisaOutcome(
  caseId: string,
  visaApplicationId: string,
  payload: { status: "APPROVED" | "REJECTED"; visaNumber?: string; notes?: string },
): Promise<VisaApplication> {
  const response = await api.patch<ApiSuccess<VisaApplication>>(
    `/cases/${caseId}/visa-applications/${visaApplicationId}/outcome`,
    payload,
  );
  return unwrap(response);
}

export { getErrorMessage };
export type { CaseListItem };
