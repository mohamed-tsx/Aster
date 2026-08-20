import api, { getErrorMessage } from "@/utils/api";
import type { Agency } from "@/types/agency";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export type AgencyPayload = {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
};

export async function listAgencies(): Promise<Agency[]> {
  const response = await api.get<ApiSuccess<{ agencies: Agency[] }>>("/agencies");
  return unwrap(response).agencies;
}

export async function createAgency(payload: AgencyPayload): Promise<Agency> {
  const response = await api.post<ApiSuccess<Agency>>("/agencies", payload);
  return unwrap(response);
}

export async function updateAgency(
  id: string,
  payload: AgencyPayload,
): Promise<Agency> {
  const response = await api.put<ApiSuccess<Agency>>(`/agencies/${id}`, payload);
  return unwrap(response);
}

export async function deleteAgency(id: string): Promise<void> {
  const response = await api.delete<ApiSuccess<null>>(`/agencies/${id}`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
}

export { getErrorMessage };
