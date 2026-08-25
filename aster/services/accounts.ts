import api, { getErrorMessage } from "@/utils/api";
import type { Account } from "@/types/account";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export async function listAccounts(): Promise<Account[]> {
  const response = await api.get<ApiSuccess<{ accounts: Account[] }>>("/accounts");
  return unwrap(response).accounts;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createAccount(payload: Record<string, any>): Promise<Account> {
  const response = await api.post<ApiSuccess<Account>>("/accounts", payload);
  return unwrap(response);
}

export { getErrorMessage };
