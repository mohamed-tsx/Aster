import asyncHandler from "express-async-handler";
import {
  searchPatients,
  listCases,
  getCaseById,
  createCase,
  updateCase,
  sendInquiry,
  respondToInquiry,
  cancelCase,
} from "../../Services/Cases/casesService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const searchPatientsCtrl = asyncHandler(async (req, res) => {
  const patients = await searchPatients(req.query.passportNumber);
  return sendSuccess(res, "Patients retrieved successfully", { patients });
});

export const listCasesCtrl = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const { status, reachOutType, assignedToId, q } = req.query;

  const result = await listCases({ page, limit, status, reachOutType, assignedToId, q });
  return sendSuccess(res, "Cases retrieved successfully", result);
});

export const getCaseCtrl = asyncHandler(async (req, res) => {
  const kase = await getCaseById(req.params.id);
  return sendSuccess(res, "Case retrieved successfully", kase);
});

export const createCaseCtrl = asyncHandler(async (req, res) => {
  const kase = await createCase(req.body);
  return sendCreated(res, "Case created successfully", kase);
});

export const updateCaseCtrl = asyncHandler(async (req, res) => {
  const kase = await updateCase(req.params.id, req.body);
  return sendSuccess(res, "Case updated successfully", kase);
});

export const sendInquiryCtrl = asyncHandler(async (req, res) => {
  const inquiry = await sendInquiry(req.params.id, req.body);
  return sendCreated(res, "Hospital inquiry sent successfully", inquiry);
});

export const respondInquiryCtrl = asyncHandler(async (req, res) => {
  const inquiry = await respondToInquiry(req.params.id, req.params.inquiryId, req.body);
  return sendSuccess(res, "Hospital inquiry response recorded", inquiry);
});

export const cancelCaseCtrl = asyncHandler(async (req, res) => {
  const kase = await cancelCase(req.params.id);
  return sendSuccess(res, "Case cancelled successfully", kase);
});
