import api, { getErrorMessage } from "@/utils/api";
import type { Role } from "@/types/role";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export async function listRoles(): Promise<Role[]> {
  const response = await api.get<ApiSuccess<{ roles: Role[] }>>("/roles");
  return unwrap(response).roles;
}

export async function createRole(payload: {
  name: string;
  permissionIds: string[];
}): Promise<Role> {
  const response = await api.post<ApiSuccess<Role>>("/roles", payload);
  return unwrap(response);
}

export async function updateRole(
  id: string,
  payload: { name?: string; permissionIds?: string[] },
): Promise<Role> {
  const response = await api.put<ApiSuccess<Role>>(`/roles/${id}`, payload);
  return unwrap(response);
}

export async function deleteRole(id: string): Promise<void> {
  const response = await api.delete<ApiSuccess<null>>(`/roles/${id}`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
}

export { getErrorMessage };
