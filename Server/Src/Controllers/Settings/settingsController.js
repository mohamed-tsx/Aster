import asyncHandler from "express-async-handler";
import { getSettings, updateSettings } from "../../Services/Settings/settingsService.js";
import { sendSuccess } from "../../Utils/Response/apiResponse.js";

export const getSettingsCtrl = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  return sendSuccess(res, "Settings retrieved successfully", { settings });
});

export const updateSettingsCtrl = asyncHandler(async (req, res) => {
  const settings = await updateSettings(req.body, req.user.id);
  return sendSuccess(res, "Settings updated successfully", { settings });
});
