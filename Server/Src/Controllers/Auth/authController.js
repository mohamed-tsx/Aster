import asyncHandler from "express-async-handler";
import {
  loginUser,
  refreshAccessToken,
  getCurrentUser,
  changePassword,
  updateProfile,
} from "../../Services/Auth/authService.js";
import { setCookie, clearCookie } from "../../Utils/Cookie/index.js";
import { sendSuccess } from "../../Utils/Response/apiResponse.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import { saveAvatarLocal } from "../../Utils/Avatar/saveAvatarLocal.js";

/**
 * POST /api/v1/auth/login
 * Login user with username and password
 */
export const loginCtrl = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new AppError("Username and password are required", 400);
  }

  const { user, accessToken, refreshToken } = await loginUser(
    username,
    password,
  );

  // Set tokens in HTTP-only cookies only
  setCookie(res, "token", accessToken, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  setCookie(res, "refreshToken", refreshToken, {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  return sendSuccess(res, "Login successful", { user });
});

/**
 * POST /api/v1/auth/logout
 * Logout user (clear cookies)
 */
export const logoutCtrl = asyncHandler(async (req, res) => {
  clearCookie(res, "token");
  clearCookie(res, "refreshToken");

  return sendSuccess(res, "Logout successful");
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
export const refreshTokenCtrl = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw new AppError("Refresh token is required", 401);
  }

  const { accessToken } = await refreshAccessToken(refreshToken);

  setCookie(res, "token", accessToken, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return sendSuccess(res, "Token refreshed successfully");
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user profile
 */
export const getMeCtrl = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user.id);
  return sendSuccess(res, "User profile retrieved successfully", user);
});

/**
 * PUT /api/v1/auth/change-password
 * Change user password
 */
export const changePasswordCtrl = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError("Current password and new password are required", 400);
  }

  if (newPassword.length < 8) {
    throw new AppError("New password must be at least 8 characters long", 400);
  }

  await changePassword(req.user.id, currentPassword, newPassword);

  return sendSuccess(res, "Password changed successfully");
});

/**
 * PUT /api/v1/auth/profile
 * Update user profile (self-service)
 */
export const updateProfileCtrl = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, username } = req.body;
  const updateData = {};

  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (email !== undefined) updateData.email = email;
  if (username !== undefined) updateData.username = username;

  // Handle avatar upload
  if (req.file?.buffer) {
    updateData.avatar = await saveAvatarLocal(
      req.file.buffer,
      "users",
      req.user.id,
      {
        preserveOriginal: true,
        mimeType: req.file.mimetype,
      },
    );
  }

  const updated = await updateProfile(req.user.id, updateData);
  return sendSuccess(res, "Profile updated successfully", updated);
});
