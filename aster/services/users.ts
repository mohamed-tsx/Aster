import api, { getErrorMessage } from "@/utils/api";
import type {
  AdminUser,
  CreateUserPayload,
  UpdateUserPayload,
  UsersListResult,
} from "@/types/user";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

export type ListUsersParams = {
  page?: number;
  limit?: number;
};

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export async function listUsers(
  params: ListUsersParams = {},
): Promise<UsersListResult> {
  const response = await api.get<ApiSuccess<UsersListResult>>("/users", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
  });
  return unwrap(response);
}

export async function getUserById(id: string): Promise<AdminUser> {
  const response = await api.get<ApiSuccess<AdminUser>>(`/users/${id}`);
  return unwrap(response);
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<AdminUser> {
  const response = await api.post<ApiSuccess<AdminUser>>("/users", payload);
  return unwrap(response);
}

export async function updateUser(
  id: string,
  payload: UpdateUserPayload,
): Promise<AdminUser> {
  const response = await api.put<ApiSuccess<AdminUser>>(
    `/users/${id}`,
    payload,
  );
  return unwrap(response);
}

export async function deleteUser(id: string): Promise<{ id: string }> {
  const response = await api.delete<ApiSuccess<null>>(`/users/${id}`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return { id };
}

export { getErrorMessage };
