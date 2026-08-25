import fs from "fs/promises";
import path from "path";

const EXTENSION_BY_MIME_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/**
 * @param {Buffer} buffer
 * @param {string} caseId
 * @param {string} documentId
 * @param {string} mimeType
 * @returns {Promise<string>} the public URL Express serves this file at
 */
export async function saveDocumentLocal(buffer, caseId, documentId, mimeType) {
  const extension = EXTENSION_BY_MIME_TYPE[mimeType];
  if (!extension) {
    throw new Error(`Unsupported document mime type: ${mimeType}`);
  }

  const dir = path.join(process.cwd(), "uploads", "documents", caseId);
  await fs.mkdir(dir, { recursive: true });

  const fileName = `${documentId}.${extension}`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);

  return `/uploads/documents/${caseId}/${fileName}`;
}

/**
 * Best-effort file cleanup — matches saveAvatarLocal's existing pattern of ignoring
 * cleanup errors so a filesystem issue never blocks the DB delete that already
 * succeeded.
 * @param {string} fileUrl
 */
export async function deleteDocumentFile(fileUrl) {
  try {
    const relativePath = fileUrl.replace(/^\/uploads\//, "");
    const filePath = path.join(process.cwd(), "uploads", relativePath);
    await fs.unlink(filePath);
  } catch (_error) {
    // Ignore cleanup errors to avoid blocking deletion.
  }
}
