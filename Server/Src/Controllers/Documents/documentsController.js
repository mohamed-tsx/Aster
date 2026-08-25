import asyncHandler from "express-async-handler";
import { uploadDocumentForCase, deleteDocument } from "../../Services/Documents/documentsService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const uploadDocumentCtrl = asyncHandler(async (req, res) => {
  const document = await uploadDocumentForCase(
    req.params.caseId,
    req.body,
    req.file,
    req.user.id,
  );
  return sendCreated(res, "Document uploaded successfully", document);
});

export const deleteDocumentCtrl = asyncHandler(async (req, res) => {
  await deleteDocument(req.params.caseId, req.params.id);
  return sendSuccess(res, "Document deleted successfully");
});
