import crypto from "crypto";
import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import { saveDocumentLocal, deleteDocumentFile } from "../../Utils/Documents/saveDocumentLocal.js";

const DOCUMENT_TYPES = [
  "PATIENT_PASSPORT",
  "ATTENDANT_PASSPORT",
  "CASE_DOCUMENT",
  "EVALUATION_DOC",
  "INVITATION_LETTER",
  "VISA_COPY",
  "OTHER",
];

/**
 * @param {string} caseId
 * @param {{ type: string }} data
 * @param {{ buffer: Buffer, mimetype: string, originalname: string }} file
 * @param {string} userId
 */
export const uploadDocumentForCase = async (caseId, data, file, userId) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }

  if (!file) {
    throw new AppError("A file is required", 400, "VALIDATION_ERROR");
  }

  const { type } = data;
  if (!DOCUMENT_TYPES.includes(type)) {
    throw new AppError(
      `type must be one of: ${DOCUMENT_TYPES.join(", ")}`,
      400,
      "VALIDATION_ERROR",
    );
  }

  // Generate the id before touching the database and write the file to disk first.
  // If the write fails, nothing has touched the database — the failure mode is an
  // orphan file on disk (harmless), not a Document row with a permanently broken
  // fileUrl.
  const documentId = crypto.randomUUID();
  const fileUrl = await saveDocumentLocal(file.buffer, caseId, documentId, file.mimetype);

  return Prisma.document.create({
    data: {
      id: documentId,
      caseId,
      type,
      fileName: file.originalname,
      fileUrl,
      uploadedById: userId,
    },
  });
};

/**
 * @param {string} caseId
 * @param {string} documentId
 */
export const deleteDocument = async (caseId, documentId) => {
  const document = await Prisma.document.findUnique({ where: { id: documentId } });
  if (!document || document.caseId !== caseId) {
    throw new AppError("Document not found", 404, "NOT_FOUND");
  }

  await Prisma.document.delete({ where: { id: documentId } });
  await deleteDocumentFile(document.fileUrl);

  return true;
};
