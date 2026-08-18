import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import {
  assertNoSelfEscalation,
  ADMIN_ROLE_NAME,
} from "../../Utils/Rbac/assertNoSelfEscalation.js";

const ROLE_INCLUDE = {
  permissions: true,
  _count: { select: { users: true } },
};

export const listRoles = async () => {
  return Prisma.role.findMany({
    include: ROLE_INCLUDE,
    orderBy: { name: "asc" },
  });
};

/**
 * @param {{ name: string, permissionIds?: string[] }} data
 * @param {object} requestingUser - req.user (with role.permissions included)
 */
export const createRole = async (data, requestingUser) => {
  const { name, permissionIds = [] } = data;

  if (!name?.trim()) {
    throw new AppError("Role name is required", 400, "VALIDATION_ERROR");
  }

  await assertNoSelfEscalation(permissionIds, requestingUser);

  const existing = await Prisma.role.findUnique({ where: { name: name.trim() } });
  if (existing) {
    throw new AppError("Role name already exists", 409, "CONFLICT");
  }

  return Prisma.role.create({
    data: {
      name: name.trim(),
      permissions: { connect: permissionIds.map((id) => ({ id })) },
    },
    include: ROLE_INCLUDE,
  });
};

/**
 * @param {string} roleId
 * @param {{ name?: string, permissionIds?: string[] }} data
 * @param {object} requestingUser
 */
export const updateRole = async (roleId, data, requestingUser) => {
  const role = await Prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new AppError("Role not found", 404, "NOT_FOUND");
  }

  const updateData = {};

  if (data.name !== undefined) {
    if (role.name === ADMIN_ROLE_NAME) {
      throw new AppError("The ADMIN role cannot be renamed", 400, "VALIDATION_ERROR");
    }
    if (!data.name?.trim()) {
      throw new AppError("Role name is required", 400, "VALIDATION_ERROR");
    }
    const dup = await Prisma.role.findFirst({
      where: { name: data.name.trim(), id: { not: roleId } },
    });
    if (dup) {
      throw new AppError("Role name already exists", 409, "CONFLICT");
    }
    updateData.name = data.name.trim();
  }

  if (data.permissionIds !== undefined) {
    await assertNoSelfEscalation(data.permissionIds, requestingUser);

    if (role.name === ADMIN_ROLE_NAME) {
      const manageRoles = await Prisma.permission.findUnique({
        where: { name: "MANAGE_ROLES" },
      });
      if (manageRoles && !data.permissionIds.includes(manageRoles.id)) {
        throw new AppError(
          "The ADMIN role must always keep MANAGE_ROLES",
          400,
          "VALIDATION_ERROR",
        );
      }
    }

    updateData.permissions = { set: data.permissionIds.map((id) => ({ id })) };
  }

  return Prisma.role.update({
    where: { id: roleId },
    data: updateData,
    include: ROLE_INCLUDE,
  });
};

export const deleteRole = async (roleId) => {
  const role = await Prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  });

  if (!role) {
    throw new AppError("Role not found", 404, "NOT_FOUND");
  }

  if (role.name === ADMIN_ROLE_NAME) {
    throw new AppError("The ADMIN role cannot be deleted", 400, "VALIDATION_ERROR");
  }

  if (role._count.users > 0) {
    throw new AppError(
      `Cannot delete role: ${role._count.users} user(s) are still assigned to it. Reassign them first.`,
      409,
      "CONFLICT",
    );
  }

  await Prisma.role.delete({ where: { id: roleId } });
  return true;
};
