// Named CaseDocument (not Document) to avoid clashing with the DOM's global
// `Document` type.
export type DocumentType =
  | "PATIENT_PASSPORT"
  | "ATTENDANT_PASSPORT"
  | "CASE_DOCUMENT"
  | "EVALUATION_DOC"
  | "INVITATION_LETTER"
  | "VISA_COPY"
  | "OTHER";

export type CaseDocument = {
  id: string;
  caseId: string;
  type: DocumentType;
  fileUrl: string;
  fileName: string;
  uploadedById: string;
  createdAt: string;
};
