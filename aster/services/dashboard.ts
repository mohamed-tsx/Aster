import api, { getErrorMessage } from "@/utils/api";
import type { ActivityItem, CaseStats, ExpiringPassport, FinanceStats } from "@/types/dashboard";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export async function getCaseStats(): Promise<CaseStats> {
  const response = await api.get<ApiSuccess<CaseStats>>("/dashboard/case-stats");
  return unwrap(response);
}

export async function getFinanceStats(): Promise<FinanceStats> {
  const response = await api.get<ApiSuccess<FinanceStats>>("/dashboard/finance-stats");
  return unwrap(response);
}

export async function getRecentActivity(limit = 15): Promise<ActivityItem[]> {
  const response = await api.get<ApiSuccess<{ activity: ActivityItem[] }>>(
    "/dashboard/recent-activity",
    { params: { limit } },
  );
  return unwrap(response).activity;
}

export async function getExpiringPassports(days = 90): Promise<ExpiringPassport[]> {
  const response = await api.get<ApiSuccess<{ passports: ExpiringPassport[] }>>(
    "/dashboard/expiring-passports",
    { params: { days } },
  );
  return unwrap(response).passports;
}

export { getErrorMessage };
