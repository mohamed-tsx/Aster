import asyncHandler from "express-async-handler";
import {
  listHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
} from "../../Services/Hospitals/hospitalsService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listHospitalsCtrl = asyncHandler(async (req, res) => {
  const hospitals = await listHospitals();
  return sendSuccess(res, "Hospitals retrieved successfully", { hospitals });
});

export const createHospitalCtrl = asyncHandler(async (req, res) => {
  const hospital = await createHospital(req.body);
  return sendCreated(res, "Hospital created successfully", hospital);
});

export const updateHospitalCtrl = asyncHandler(async (req, res) => {
  const hospital = await updateHospital(req.params.id, req.body);
  return sendSuccess(res, "Hospital updated successfully", hospital);
});

export const deleteHospitalCtrl = asyncHandler(async (req, res) => {
  await deleteHospital(req.params.id);
  return sendSuccess(res, "Hospital deleted successfully");
});
