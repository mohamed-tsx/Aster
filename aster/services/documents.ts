import api, { getErrorMessage } from "@/utils/api";
import type { CaseDocument, DocumentType } from "@/types/document";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export async function uploadDocument(
  caseId: string,
  file: File,
  type: DocumentType,
): Promise<CaseDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await api.post<ApiSuccess<CaseDocument>>(
    `/cases/${caseId}/documents`,
    formData,
  );
  return unwrap(response);
}

export async function deleteDocument(caseId: string, documentId: string): Promise<void> {
  const response = await api.delete<ApiSuccess<null>>(
    `/cases/${caseId}/documents/${documentId}`,
  );
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
}

export { getErrorMessage };
