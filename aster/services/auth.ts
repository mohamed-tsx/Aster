import api, { getErrorMessage } from "@/utils/api";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export type ProfileUpdate = {
  firstName: string;
  lastName: string;
  email?: string;
  avatar?: File;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateProfile(payload: ProfileUpdate): Promise<any> {
  const formData = new FormData();
  formData.append("firstName", payload.firstName);
  formData.append("lastName", payload.lastName);
  if (payload.email !== undefined) formData.append("email", payload.email);
  if (payload.avatar) formData.append("avatar", payload.avatar);

  const response = await api.put<ApiSuccess<unknown>>("/auth/profile", formData);
  return unwrap(response);
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const response = await api.put<ApiSuccess<null>>("/auth/change-password", payload);
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
}

export { getErrorMessage };
