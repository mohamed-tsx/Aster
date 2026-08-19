import Prisma from "../../Config/Prisma/db.js";
import { hashPassword } from "../../Utils/Password/index.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import { generateCustomUserId } from "../../Config/Generators/ID/customUserIdGenerator.js";
import { syncFile } from "../File/fileService.js";
import {
  assertNoSelfEscalation,
  assertCanManageUser,
} from "../../Utils/Rbac/assertNoSelfEscalation.js";

// Loads a target user together with the permissions their role holds, so
// assertCanManageUser can compare them against the requester's own set.
const TARGET_USER_INCLUDE = { role: { include: { permissions: true } } };

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  avatar: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

const resolveRole = async (roleId, roleName) => {
  if (roleId) {
    const role = await Prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: true },
    });
    if (!role) throw new AppError("Role not found", 404, "NOT_FOUND");
    return role;
  }

  if (roleName) {
    const role = await Prisma.role.findUnique({
      where: { name: roleName },
      include: { permissions: true },
    });
    if (!role) throw new AppError("Role not found", 404, "NOT_FOUND");
    return role;
  }

  throw new AppError("roleId or role is required", 400, "VALIDATION_ERROR");
};

/**
 * List users with pagination
 * @param {{ page?: number, limit?: number }} params
 */
export const listUsers = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    Prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: USER_SELECT,
    }),
    Prisma.user.count(),
  ]);

  return { users, total, page, limit };
};

/**
 * Get a single user by ID
 * @param {string} userId
 */
export const getUserById = async (userId) => {
  const user = await Prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });

  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  return user;
};

/**
 * Create a new user
 * @param {Object} data - username, email, password, firstName, lastName, roleId or role
 */
export const createUser = async (data, requestingUser) => {
  const { username, email, password, firstName, lastName, roleId, role } =
    data;

  if (!username || !password || !firstName || !lastName) {
    throw new AppError(
      "username, password, firstName, and lastName are required",
      400,
      "VALIDATION_ERROR",
    );
  }

  const resolvedRole = await resolveRole(roleId, role);
  await assertNoSelfEscalation(
    resolvedRole.permissions.map((p) => p.id),
    requestingUser,
  );
  const hashedPassword = await hashPassword(password);
  const userId = await generateCustomUserId(resolvedRole.name);

  const user = await Prisma.user.create({
    data: {
      id: userId,
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      roleId: resolvedRole.id,
    },
    select: USER_SELECT,
  });

  return user;
};

/**
 * Update an existing user
 * @param {string} userId
 * @param {Object} data - firstName, lastName, email, username, password, roleId or role
 */
export const updateUser = async (userId, data, requestingUser) => {
  const existing = await Prisma.user.findUnique({
    where: { id: userId },
    include: TARGET_USER_INCLUDE,
  });

  if (!existing) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  assertCanManageUser(existing, requestingUser);

  const updateFields = {};

  if (data.firstName !== undefined) updateFields.firstName = data.firstName;
  if (data.lastName !== undefined) updateFields.lastName = data.lastName;

  if (data.email !== undefined) {
    const emailExists = await Prisma.user.findFirst({
      where: { email: data.email, id: { not: userId } },
    });
    if (emailExists) {
      throw new AppError("Email already in use", 409, "CONFLICT");
    }
    updateFields.email = data.email;
  }

  if (data.username !== undefined) {
    const usernameExists = await Prisma.user.findFirst({
      where: { username: data.username, id: { not: userId } },
    });
    if (usernameExists) {
      throw new AppError("Username already in use", 409, "CONFLICT");
    }
    updateFields.username = data.username;
  }

  if (data.roleId !== undefined || data.role !== undefined) {
    const resolvedRole = await resolveRole(data.roleId, data.role);

    // The client always round-trips the current roleId, so only treat this as
    // an actual reassignment (and run the escalation check) when the role
    // really changes. Re-sending the same role grants nothing new.
    if (resolvedRole.id !== existing.roleId) {
      await assertNoSelfEscalation(
        resolvedRole.permissions.map((p) => p.id),
        requestingUser,
      );
      updateFields.roleId = resolvedRole.id;
    }
  }

  if (data.password !== undefined) {
    updateFields.password = await hashPassword(data.password);
  }

  const updated = await Prisma.user.update({
    where: { id: userId },
    data: updateFields,
    select: USER_SELECT,
  });

  return updated;
};

/**
 * Delete a user
 * @param {string} userId
 * @param {object} requestingUser - the authenticated user performing the delete (with role.permissions)
 */
export const deleteUser = async (userId, requestingUser) => {
  if (userId === requestingUser?.id) {
    throw new AppError(
      "You cannot delete your own account",
      400,
      "VALIDATION_ERROR",
    );
  }

  const existing = await Prisma.user.findUnique({
    where: { id: userId },
    include: TARGET_USER_INCLUDE,
  });

  if (!existing) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  assertCanManageUser(existing, requestingUser);

  if (existing.avatar) {
    await syncFile(existing.avatar, null);
  }

  await Prisma.user.delete({ where: { id: userId } });

  return true;
};
