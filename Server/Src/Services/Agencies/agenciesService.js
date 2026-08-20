import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const AGENCY_INCLUDE = {
  _count: { select: { cases: true } },
};

export const listAgencies = async () => {
  return Prisma.agency.findMany({
    include: AGENCY_INCLUDE,
    orderBy: { name: "asc" },
  });
};

/**
 * @param {{ name: string, contactPerson?: string, phone?: string, email?: string, address?: string }} data
 */
export const createAgency = async (data) => {
  const { name, contactPerson, phone, email, address } = data;

  if (!name?.trim()) {
    throw new AppError("Agency name is required", 400, "VALIDATION_ERROR");
  }

  const existing = await Prisma.agency.findUnique({ where: { name: name.trim() } });
  if (existing) {
    throw new AppError("Agency name already exists", 409, "CONFLICT");
  }

  return Prisma.agency.create({
    data: {
      name: name.trim(),
      contactPerson: contactPerson?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      address: address?.trim() || null,
    },
    include: AGENCY_INCLUDE,
  });
};

/**
 * @param {string} agencyId
 * @param {{ name?: string, contactPerson?: string, phone?: string, email?: string, address?: string }} data
 */
export const updateAgency = async (agencyId, data) => {
  const agency = await Prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) {
    throw new AppError("Agency not found", 404, "NOT_FOUND");
  }

  const updateData = {};

  if (data.name !== undefined) {
    if (typeof data.name !== "string" || !data.name.trim()) {
      throw new AppError("Agency name is required", 400, "VALIDATION_ERROR");
    }
    const dup = await Prisma.agency.findFirst({
      where: { name: data.name.trim(), id: { not: agencyId } },
    });
    if (dup) {
      throw new AppError("Agency name already exists", 409, "CONFLICT");
    }
    updateData.name = data.name.trim();
  }

  if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson?.trim() || null;
  if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
  if (data.email !== undefined) updateData.email = data.email?.trim() || null;
  if (data.address !== undefined) updateData.address = data.address?.trim() || null;

  return Prisma.agency.update({
    where: { id: agencyId },
    data: updateData,
    include: AGENCY_INCLUDE,
  });
};

export const deleteAgency = async (agencyId) => {
  const agency = await Prisma.agency.findUnique({
    where: { id: agencyId },
    include: { _count: { select: { cases: true } } },
  });

  if (!agency) {
    throw new AppError("Agency not found", 404, "NOT_FOUND");
  }

  if (agency._count.cases > 0) {
    throw new AppError(
      `Cannot delete agency: ${agency._count.cases} case(s) are still linked to it. Reassign them first.`,
      409,
      "CONFLICT",
    );
  }

  await Prisma.agency.delete({ where: { id: agencyId } });
  return true;
};
