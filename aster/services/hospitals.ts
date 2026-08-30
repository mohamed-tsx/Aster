import api, { getErrorMessage } from "@/utils/api";
import type { Hospital } from "@/types/hospital";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export type HospitalPayload = {
  name: string;
  city: string;
  country: string;
  specialties?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
};

export async function listHospitals(): Promise<Hospital[]> {
  const response = await api.get<ApiSuccess<{ hospitals: Hospital[] }>>("/hospitals");
  return unwrap(response).hospitals;
}

export async function createHospital(payload: HospitalPayload): Promise<Hospital> {
  const response = await api.post<ApiSuccess<Hospital>>("/hospitals", payload);
  return unwrap(response);
}

export async function updateHospital(
  id: string,
  payload: HospitalPayload,
): Promise<Hospital> {
  const response = await api.put<ApiSuccess<Hospital>>(`/hospitals/${id}`, payload);
  return unwrap(response);
}

export async function deleteHospital(id: string): Promise<void> {
  const response = await api.delete<ApiSuccess<null>>(`/hospitals/${id}`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
}

export { getErrorMessage };
