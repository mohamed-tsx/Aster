import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const HOSPITAL_INCLUDE = {
  _count: { select: { inquiries: true } },
};

export const listHospitals = async () => {
  return Prisma.hospital.findMany({
    include: HOSPITAL_INCLUDE,
    orderBy: { name: "asc" },
  });
};

/**
 * @param {{ name: string, city: string, country: string, specialties?: string, contactPerson?: string, phone?: string, email?: string }} data
 */
export const createHospital = async (data) => {
  const { name, city, country, specialties, contactPerson, phone, email } = data;

  if (!name?.trim()) {
    throw new AppError("Hospital name is required", 400, "VALIDATION_ERROR");
  }
  if (!city?.trim()) {
    throw new AppError("City is required", 400, "VALIDATION_ERROR");
  }
  if (!country?.trim()) {
    throw new AppError("Country is required", 400, "VALIDATION_ERROR");
  }

  return Prisma.hospital.create({
    data: {
      name: name.trim(),
      city: city.trim(),
      country: country.trim(),
      specialties: specialties?.trim() || null,
      contactPerson: contactPerson?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
    },
    include: HOSPITAL_INCLUDE,
  });
};

/**
 * @param {string} hospitalId
 * @param {{ name?: string, city?: string, country?: string, specialties?: string, contactPerson?: string, phone?: string, email?: string }} data
 */
export const updateHospital = async (hospitalId, data) => {
  const hospital = await Prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) {
    throw new AppError("Hospital not found", 404, "NOT_FOUND");
  }

  const updateData = {};

  if (data.name !== undefined) {
    if (typeof data.name !== "string" || !data.name.trim()) {
      throw new AppError("Hospital name is required", 400, "VALIDATION_ERROR");
    }
    updateData.name = data.name.trim();
  }

  if (data.city !== undefined) {
    if (!data.city?.trim()) {
      throw new AppError("City is required", 400, "VALIDATION_ERROR");
    }
    updateData.city = data.city.trim();
  }

  if (data.country !== undefined) {
    if (!data.country?.trim()) {
      throw new AppError("Country is required", 400, "VALIDATION_ERROR");
    }
    updateData.country = data.country.trim();
  }

  if (data.specialties !== undefined) updateData.specialties = data.specialties?.trim() || null;
  if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson?.trim() || null;
  if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
  if (data.email !== undefined) updateData.email = data.email?.trim() || null;

  return Prisma.hospital.update({
    where: { id: hospitalId },
    data: updateData,
    include: HOSPITAL_INCLUDE,
  });
};

export const deleteHospital = async (hospitalId) => {
  const hospital = await Prisma.hospital.findUnique({
    where: { id: hospitalId },
    include: { _count: { select: { inquiries: true } } },
  });

  if (!hospital) {
    throw new AppError("Hospital not found", 404, "NOT_FOUND");
  }

  if (hospital._count.inquiries > 0) {
    throw new AppError(
      `Cannot delete hospital: it has ${hospital._count.inquiries} inquiry/inquiries on record. Remove or reassign them first.`,
      409,
      "CONFLICT",
    );
  }

  await Prisma.hospital.delete({ where: { id: hospitalId } });
  return true;
};
