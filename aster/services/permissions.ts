import api, { getErrorMessage } from "@/utils/api";
import type { Permission } from "@/types/role";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export async function listPermissions(): Promise<Permission[]> {
  const response = await api.get<ApiSuccess<{ permissions: Permission[] }>>(
    "/permissions",
  );
  return unwrap(response).permissions;
}

export async function createPermission(payload: {
  name: string;
}): Promise<Permission> {
  const response = await api.post<ApiSuccess<Permission>>("/permissions", payload);
  return unwrap(response);
}

export async function updatePermission(
  id: string,
  payload: { name: string },
): Promise<Permission> {
  const response = await api.put<ApiSuccess<Permission>>(
    `/permissions/${id}`,
    payload,
  );
  return unwrap(response);
}

export async function deletePermission(id: string): Promise<void> {
  const response = await api.delete<ApiSuccess<null>>(`/permissions/${id}`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
}

export { getErrorMessage };
