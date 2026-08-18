import Prisma from "../../Config/Prisma/db.js";
import { comparePassword, hashPassword } from "../../Utils/Password/index.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../Config/Generators/Token/index.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import { syncFile } from "../File/fileService.js";

/**
 * Login user with username and password
 * @param {string} username - Username
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} User object with tokens and roles
 */
export const loginUser = async (username, password) => {
  // Find user by username
  const user = await Prisma.user.findUnique({
    where: {
      username: username,
    },
    include: { role: true },
  });

  if (!user) {
    throw new AppError("Invalid credentials", 401, "UNAUTHORIZED");
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password);

  if (!isPasswordValid) {
    throw new AppError("Invalid credentials", 401, "UNAUTHORIZED");
  }

  // Generate tokens with role embedded
  const accessToken = generateAccessToken(user, user.role.name);
  const refreshToken = generateRefreshToken(user);

  // Remove password from user object
  const { password: _, ...userWithoutPassword } = user;

  return {
    user: {
      ...userWithoutPassword,
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New access token
 */
export const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = verifyRefreshToken(refreshToken);

    // Find user with role
    const user = await Prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }

    // Generate new access token with role
    const accessToken = generateAccessToken(user, user.role.name);

    return {
      accessToken,
    };
  } catch (error) {
    throw new AppError("Invalid refresh token", 401, "UNAUTHORIZED");
  }
};

/**
 * Get current user profile
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile
 */
export const getCurrentUser = async (userId) => {
  const user = await Prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  return user;
};

/**
 * Update user profile (self-service)
 * @param {string} userId - User ID
 * @param {Object} updateData - Update data (firstName, lastName, email, username, avatar)
 * @returns {Promise<Object>} Updated user
 */
export const updateProfile = async (userId, updateData) => {
  const existing = await Prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existing) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  // Only allow updating firstName, lastName, email, username, and avatar
  const updateFields = {};

  if (updateData.firstName !== undefined) {
    updateFields.firstName = updateData.firstName;
  }
  if (updateData.lastName !== undefined) {
    updateFields.lastName = updateData.lastName;
  }
  if (updateData.email !== undefined) {
    // Check if email is already taken by another user
    const emailExists = await Prisma.user.findFirst({
      where: {
        email: updateData.email,
        id: { not: userId },
      },
    });
    if (emailExists) {
      throw new AppError("Email already in use", 409, "CONFLICT");
    }
    updateFields.email = updateData.email;
  }
  if (updateData.username !== undefined) {
    // Check if username is already taken by another user
    const usernameExists = await Prisma.user.findFirst({
      where: {
        username: updateData.username,
        id: { not: userId },
      },
    });
    if (usernameExists) {
      throw new AppError("Username already in use", 409, "CONFLICT");
    }
    updateFields.username = updateData.username;
  }
  if (updateData.avatar !== undefined) {
    updateFields.avatar = updateData.avatar;
    // Sync avatar file if changed
    if (existing.avatar) {
      await syncFile(existing.avatar, updateData.avatar);
    }
  }

  const updated = await Prisma.user.update({
    where: { id: userId },
    data: updateFields,
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated;
};

/**
 * Change user password
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} Success status
 */
export const changePassword = async (userId, currentPassword, newPassword) => {
  // Find user
  const user = await Prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  // Verify current password
  const isPasswordValid = await comparePassword(currentPassword, user.password);

  if (!isPasswordValid) {
    throw new AppError(
      "Current password is incorrect",
      400,
      "VALIDATION_ERROR",
    );
  }

  // Hash new password
  const hashedNewPassword = await hashPassword(newPassword);

  // Update password
  await Prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedNewPassword,
    },
  });

  return true;
};
