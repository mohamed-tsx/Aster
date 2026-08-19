import asyncHandler from "express-async-handler";
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../../Services/Users/usersService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

/**
 * GET /api/v1/users
 * List users (paginated)
 */
export const listUsersCtrl = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const result = await listUsers({ page, limit });
  return sendSuccess(res, "Users retrieved successfully", result);
});

/**
 * GET /api/v1/users/:id
 * Get a single user
 */
export const getUserCtrl = asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  return sendSuccess(res, "User retrieved successfully", user);
});

/**
 * POST /api/v1/users
 * Create a new user
 */
export const createUserCtrl = asyncHandler(async (req, res) => {
  const user = await createUser(req.body, req.user);
  return sendCreated(res, "User created successfully", user);
});

/**
 * PUT /api/v1/users/:id
 * Update a user
 */
export const updateUserCtrl = asyncHandler(async (req, res) => {
  const user = await updateUser(req.params.id, req.body, req.user);
  return sendSuccess(res, "User updated successfully", user);
});

/**
 * DELETE /api/v1/users/:id
 * Delete a user
 */
export const deleteUserCtrl = asyncHandler(async (req, res) => {
  await deleteUser(req.params.id, req.user);
  return sendSuccess(res, "User deleted successfully");
});
