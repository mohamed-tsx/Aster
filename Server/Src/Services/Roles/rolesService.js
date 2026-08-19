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
  const role = await Prisma.role.findUnique({
    where: { id: roleId },
    include: { permissions: true },
  });
  if (!role) {
    throw new AppError("Role not found", 404, "NOT_FOUND");
  }

  const updateData = {};

  if (data.name !== undefined) {
    if (typeof data.name !== "string" || !data.name.trim()) {
      throw new AppError("Role name is required", 400, "VALIDATION_ERROR");
    }
    // The UI always round-trips the current name (the input is disabled but
    // still holds form state), so only reject a genuine rename of ADMIN.
    if (role.name === ADMIN_ROLE_NAME && data.name.trim() !== role.name) {
      throw new AppError("The ADMIN role cannot be renamed", 400, "VALIDATION_ERROR");
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
    // Validates shape/existence of the new set and rejects permissions the
    // requester is trying to ADD without holding them.
    await assertNoSelfEscalation(data.permissionIds, requestingUser);

    // Symmetric guard: removing a permission from a role is just as much a
    // privilege change as adding one, so a non-ADMIN caller may only strip a
    // permission off a role if they hold that permission themselves.
    const nextIds = new Set(data.permissionIds ?? []);
    const removedIds = role.permissions
      .filter((p) => !nextIds.has(p.id))
      .map((p) => p.id);
    await assertNoSelfEscalation(removedIds, requestingUser, "remove");

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
