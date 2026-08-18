import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const SYSTEM_PERMISSION = "MANAGE_ROLES";

const normalizeName = (name) => name.trim().toUpperCase().replace(/\s+/g, "_");

export const listPermissions = async () => {
  return Prisma.permission.findMany({
    include: { _count: { select: { roles: true } } },
    orderBy: { name: "asc" },
  });
};

export const createPermission = async (data) => {
  if (!data.name?.trim()) {
    throw new AppError("Permission name is required", 400, "VALIDATION_ERROR");
  }
  const name = normalizeName(data.name);
  const existing = await Prisma.permission.findUnique({ where: { name } });
  if (existing) {
    throw new AppError("Permission already exists", 409, "CONFLICT");
  }
  return Prisma.permission.create({ data: { name } });
};

export const updatePermission = async (permissionId, data) => {
  const permission = await Prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) {
    throw new AppError("Permission not found", 404, "NOT_FOUND");
  }
  if (permission.name === SYSTEM_PERMISSION) {
    throw new AppError(`${SYSTEM_PERMISSION} cannot be renamed`, 400, "VALIDATION_ERROR");
  }
  if (!data.name?.trim()) {
    throw new AppError("Permission name is required", 400, "VALIDATION_ERROR");
  }
  const name = normalizeName(data.name);
  const dup = await Prisma.permission.findFirst({
    where: { name, id: { not: permissionId } },
  });
  if (dup) {
    throw new AppError("Permission already exists", 409, "CONFLICT");
  }
  return Prisma.permission.update({ where: { id: permissionId }, data: { name } });
};

export const deletePermission = async (permissionId) => {
  const permission = await Prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) {
    throw new AppError("Permission not found", 404, "NOT_FOUND");
  }
  if (permission.name === SYSTEM_PERMISSION) {
    throw new AppError(
      `${SYSTEM_PERMISSION} is a system permission and cannot be deleted`,
      400,
      "VALIDATION_ERROR",
    );
  }
  await Prisma.permission.delete({ where: { id: permissionId } });
  return true;
};
