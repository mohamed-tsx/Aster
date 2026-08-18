import asyncHandler from "express-async-handler";
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} from "../../Services/Roles/rolesService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listRolesCtrl = asyncHandler(async (req, res) => {
  const roles = await listRoles();
  return sendSuccess(res, "Roles retrieved successfully", { roles });
});

export const createRoleCtrl = asyncHandler(async (req, res) => {
  const role = await createRole(req.body, req.user);
  return sendCreated(res, "Role created successfully", role);
});

export const updateRoleCtrl = asyncHandler(async (req, res) => {
  const role = await updateRole(req.params.id, req.body, req.user);
  return sendSuccess(res, "Role updated successfully", role);
});

export const deleteRoleCtrl = asyncHandler(async (req, res) => {
  await deleteRole(req.params.id);
  return sendSuccess(res, "Role deleted successfully");
});
