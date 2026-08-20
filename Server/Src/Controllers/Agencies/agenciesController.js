import asyncHandler from "express-async-handler";
import {
  listAgencies,
  createAgency,
  updateAgency,
  deleteAgency,
} from "../../Services/Agencies/agenciesService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listAgenciesCtrl = asyncHandler(async (req, res) => {
  const agencies = await listAgencies();
  return sendSuccess(res, "Agencies retrieved successfully", { agencies });
});

export const createAgencyCtrl = asyncHandler(async (req, res) => {
  const agency = await createAgency(req.body);
  return sendCreated(res, "Agency created successfully", agency);
});

export const updateAgencyCtrl = asyncHandler(async (req, res) => {
  const agency = await updateAgency(req.params.id, req.body);
  return sendSuccess(res, "Agency updated successfully", agency);
});

export const deleteAgencyCtrl = asyncHandler(async (req, res) => {
  await deleteAgency(req.params.id);
  return sendSuccess(res, "Agency deleted successfully");
});
