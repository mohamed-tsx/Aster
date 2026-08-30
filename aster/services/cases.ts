import api, { getErrorMessage } from "@/utils/api";
import type { Case, CaseListItem, CasesListResult, HospitalInquiry } from "@/types/case";
import type { PatientSummary } from "@/types/patient";
import type { VisaApplication } from "@/types/visa";
import type { Refund } from "@/types/refund";
import type { CaseTimelineItem } from "@/types/timeline";

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

export async function searchPatients(term: string): Promise<PatientSummary[]> {
  const response = await api.get<ApiSuccess<{ patients: PatientSummary[] }>>(
    "/cases/patients/search",
    { params: { q: term } },
  );
  return unwrap(response).patients;
}

export async function createCase(payload: FormData): Promise<Case> {
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

export async function recordChosenResponse(
  caseId: string,
  inquiryId: string,
  payload: FormData,
): Promise<Case> {
  const response = await api.post<ApiSuccess<Case>>(
    `/cases/${caseId}/inquiries/${inquiryId}/response`,
    payload,
  );
  return unwrap(response);
}

export async function changeChosenHospital(
  caseId: string,
  payload: FormData,
): Promise<Case> {
  const response = await api.post<ApiSuccess<Case>>(
    `/cases/${caseId}/chosen-hospital`,
    payload,
  );
  return unwrap(response);
}

export async function declineInquiry(
  caseId: string,
  inquiryId: string,
  notes?: string,
): Promise<HospitalInquiry> {
  const response = await api.patch<ApiSuccess<HospitalInquiry>>(
    `/cases/${caseId}/inquiries/${inquiryId}`,
    { status: "DECLINED", notes: notes || undefined },
  );
  return unwrap(response);
}

// Omits `notes` entirely when its trimmed value is empty, rather than sending
// `notes: ""`. The backend's three visa-application actions treat an *absent*
// `notes` key as "leave the existing value alone" but a present-but-blank string
// as "clear it" — so always sending `notes: ""` for an unfilled optional field
// would silently null out a note recorded at an earlier step (e.g. the outcome
// dialog's blank default nulling the embassy-visit note).
function withOptionalNotes<T extends { notes?: string }>(payload: T): T {
  const { notes, ...rest } = payload;
  if (notes === undefined || notes.trim() === "") {
    return rest as T;
  }
  return { ...rest, notes } as T;
}

export async function recordFeePayment(
  caseId: string,
  visaApplicationId: string,
  payload: { accountId: string; amount: string; notes?: string },
): Promise<VisaApplication> {
  const response = await api.post<ApiSuccess<VisaApplication>>(
    `/cases/${caseId}/visa-applications/${visaApplicationId}/fee-payment`,
    withOptionalNotes(payload),
  );
  return unwrap(response);
}

export async function recordFeePaymentByTraveler(
  caseId: string,
  payload: { travelerType: "PATIENT" | "ATTENDANT"; accountId: string; amount: string; notes?: string },
): Promise<VisaApplication> {
  const response = await api.post<ApiSuccess<VisaApplication>>(
    `/cases/${caseId}/visa-applications/fee-payment`,
    withOptionalNotes(payload),
  );
  return unwrap(response);
}

export async function markEmbassyVisited(
  caseId: string,
  visaApplicationId: string,
  payload: {
    embassyVisitDate: string;
    notes?: string;
    partnerCommission?: { amount: string; accountId: string };
  },
): Promise<VisaApplication> {
  const response = await api.patch<ApiSuccess<VisaApplication>>(
    `/cases/${caseId}/visa-applications/${visaApplicationId}/embassy-visit`,
    withOptionalNotes(payload),
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
    withOptionalNotes(payload),
  );
  return unwrap(response);
}

export async function issueRefund(
  caseId: string,
  visaApplicationId: string,
  payload: { accountId: string; amount: string; reason: string },
): Promise<Refund> {
  const response = await api.post<ApiSuccess<Refund>>(
    `/cases/${caseId}/visa-applications/${visaApplicationId}/refund`,
    payload,
  );
  return unwrap(response);
}

export async function getCaseTimeline(caseId: string): Promise<CaseTimelineItem[]> {
  const response = await api.get<ApiSuccess<{ timeline: CaseTimelineItem[] }>>(
    `/cases/${caseId}/timeline`,
  );
  return unwrap(response).timeline;
}

export async function createCaseNote(caseId: string, body: string): Promise<void> {
  const response = await api.post<ApiSuccess<unknown>>(`/cases/${caseId}/notes`, { body });
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
}

export { getErrorMessage };
export type { CaseListItem };
