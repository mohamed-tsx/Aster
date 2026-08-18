import asyncHandler from "express-async-handler";
import {
  listPermissions,
  createPermission,
  updatePermission,
  deletePermission,
} from "../../Services/Permissions/permissionsService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listPermissionsCtrl = asyncHandler(async (req, res) => {
  const permissions = await listPermissions();
  return sendSuccess(res, "Permissions retrieved successfully", { permissions });
});

export const createPermissionCtrl = asyncHandler(async (req, res) => {
  const permission = await createPermission(req.body);
  return sendCreated(res, "Permission created successfully", permission);
});

export const updatePermissionCtrl = asyncHandler(async (req, res) => {
  const permission = await updatePermission(req.params.id, req.body);
  return sendSuccess(res, "Permission updated successfully", permission);
});

export const deletePermissionCtrl = asyncHandler(async (req, res) => {
  await deletePermission(req.params.id);
  return sendSuccess(res, "Permission deleted successfully");
});
