import asyncHandler from "express-async-handler";
import { listCaseNotes, createCaseNote } from "../../Services/CaseNotes/caseNotesService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listCaseNotesCtrl = asyncHandler(async (req, res) => {
  const notes = await listCaseNotes(req.params.caseId);
  return sendSuccess(res, "Case notes retrieved successfully", { notes });
});

export const createCaseNoteCtrl = asyncHandler(async (req, res) => {
  const note = await createCaseNote(req.params.caseId, req.body, req.user.id);
  return sendCreated(res, "Note added successfully", note);
});
