import api, { getErrorMessage } from "@/utils/api";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) throw new Error(response.data.message || "Request failed");
  return response.data.data;
}

export async function getSettings(): Promise<Record<string, string>> {
  const response = await api.get<ApiSuccess<{ settings: Record<string, string> }>>("/settings");
  return unwrap(response).settings;
}

export async function updateSettings(
  patch: Record<string, string>,
): Promise<Record<string, string>> {
  const response = await api.put<ApiSuccess<{ settings: Record<string, string> }>>(
    "/settings",
    patch,
  );
  return unwrap(response).settings;
}

export { getErrorMessage };
