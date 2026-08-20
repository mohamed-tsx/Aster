import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import { generateCaseNumber } from "../../Config/Generators/ID/customCaseIdGenerator.js";

const CASE_LIST_SELECT = {
  id: true,
  caseNumber: true,
  reachOutType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: { id: true, firstName: true, lastName: true, passportNumber: true },
  },
  agency: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
};

const CASE_DETAIL_INCLUDE = {
  patient: true,
  attendant: true,
  agency: true,
  assignedTo: { select: { id: true, firstName: true, lastName: true, username: true } },
  inquiries: {
    orderBy: { sentAt: "desc" },
    include: { hospital: true },
  },
};

const PATIENT_FIELDS = [
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiry",
  "phone",
  "email",
  "address",
];

const PATIENT_REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiry",
  "phone",
];

// Attendant fields arrive on the request body prefixed with "attendant" (e.g.
// `attendantFirstName`) since they sit flat alongside the patient's own bare
// `firstName`/`lastName`/etc. in the same JSON body — this map translates each
// Prisma `Attendant` field name to the body key that carries it.
const ATTENDANT_FIELD_MAP = {
  firstName: "attendantFirstName",
  lastName: "attendantLastName",
  gender: "attendantGender",
  dateOfBirth: "attendantDateOfBirth",
  nationality: "attendantNationality",
  passportNumber: "attendantPassportNumber",
  passportExpiry: "attendantPassportExpiry",
  phone: "attendantPhone",
  relationToPatient: "attendantRelationToPatient",
};

// Prisma's DateTime scalar requires a full ISO-8601 timestamp; a bare `YYYY-MM-DD`
// date (what a native HTML date input, and most API clients, naturally send) is
// rejected outright. Normalize date-only fields to midnight UTC before they reach
// Prisma.
const DATE_ONLY_FIELDS = new Set(["dateOfBirth", "passportExpiry"]);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateValue = (field, value) => {
  if (DATE_ONLY_FIELDS.has(field) && typeof value === "string" && DATE_ONLY_PATTERN.test(value)) {
    return `${value}T00:00:00.000Z`;
  }
  return value;
};

const pickFields = (source, fields) => {
  const picked = {};
  for (const field of fields) {
    if (source[field] !== undefined) picked[field] = normalizeDateValue(field, source[field]);
  }
  return picked;
};

const pickAttendantFields = (source) => {
  const picked = {};
  for (const [prismaField, bodyField] of Object.entries(ATTENDANT_FIELD_MAP)) {
    if (source[bodyField] !== undefined) {
      picked[prismaField] = normalizeDateValue(prismaField, source[bodyField]);
    }
  }
  return picked;
};

const assertRequiredFields = (data, fields, label) => {
  for (const field of fields) {
    if (!data[field]) {
      throw new AppError(`${label} ${field} is required`, 400, "VALIDATION_ERROR");
    }
  }
};

const assertAttendantRequiredFields = (data) => {
  for (const prismaField of Object.keys(ATTENDANT_FIELD_MAP)) {
    if (!data[prismaField]) {
      throw new AppError(`Attendant ${prismaField} is required`, 400, "VALIDATION_ERROR");
    }
  }
};

/**
 * @param {string} passportNumber
 */
export const searchPatients = async (passportNumber) => {
  if (!passportNumber?.trim()) {
    throw new AppError(
      "passportNumber query param is required",
      400,
      "VALIDATION_ERROR",
    );
  }

  return Prisma.patient.findMany({
    where: {
      passportNumber: { contains: passportNumber.trim(), mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
};

/**
 * @param {{ page?: number, limit?: number, status?: string, reachOutType?: string, assignedToId?: string, q?: string }} params
 */
export const listCases = async ({
  page = 1,
  limit = 20,
  status,
  reachOutType,
  assignedToId,
  q,
} = {}) => {
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (reachOutType) where.reachOutType = reachOutType;
  if (assignedToId) where.assignedToId = assignedToId;
  if (q?.trim()) {
    const term = q.trim();
    where.patient = {
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { passportNumber: { contains: term, mode: "insensitive" } },
      ],
    };
  }

  const [cases, total] = await Promise.all([
    Prisma.case.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: CASE_LIST_SELECT,
    }),
    Prisma.case.count({ where }),
  ]);

  return { cases, total, page, limit };
};

/**
 * @param {string} caseId
 */
export const getCaseById = async (caseId) => {
  const found = await Prisma.case.findUnique({
    where: { id: caseId },
    include: CASE_DETAIL_INCLUDE,
  });

  if (!found) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }

  return found;
};

/**
 * @param {Object} data - patientId (reuse) OR flat patient* fields (new patient),
 *   optional flat attendant* fields, reachOutType, agencyId, assignedToId, notes
 */
export const createCase = async (data) => {
  const { patientId, reachOutType, agencyId, assignedToId, notes } = data;

  if (!reachOutType || !["DIRECT", "AGENCY"].includes(reachOutType)) {
    throw new AppError("reachOutType must be DIRECT or AGENCY", 400, "VALIDATION_ERROR");
  }
  if (reachOutType === "AGENCY" && !agencyId) {
    throw new AppError(
      "agencyId is required when reachOutType is AGENCY",
      400,
      "VALIDATION_ERROR",
    );
  }

  let patientCreateData = null;
  if (!patientId) {
    patientCreateData = pickFields(data, PATIENT_FIELDS);
    assertRequiredFields(patientCreateData, PATIENT_REQUIRED_FIELDS, "Patient");
  } else {
    const existingPatient = await Prisma.patient.findUnique({ where: { id: patientId } });
    if (!existingPatient) {
      throw new AppError("Patient not found", 404, "NOT_FOUND");
    }
  }

  if (agencyId) {
    const agency = await Prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) {
      throw new AppError("Agency not found", 404, "NOT_FOUND");
    }
  }

  if (assignedToId) {
    const assignee = await Prisma.user.findUnique({ where: { id: assignedToId } });
    if (!assignee) {
      throw new AppError("Assigned user not found", 404, "NOT_FOUND");
    }
  }

  let attendantCreateData = null;
  if (data.hasAttendant) {
    attendantCreateData = pickAttendantFields(data);
    assertAttendantRequiredFields(attendantCreateData);
  }

  const caseNumber = await generateCaseNumber();

  // NOTE: `patient` below uses nested relation syntax (`connect`/`create`), which
  // forces Prisma's "checked" create-input shape for this call — that shape does not
  // accept raw scalar FK fields (`agencyId`/`assignedToId`) alongside it, only nested
  // `agency`/`assignedTo` relation objects. Using `connect` here keeps the same
  // semantics as plain scalar assignment while satisfying Prisma's input validation.
  return Prisma.case.create({
    data: {
      caseNumber,
      reachOutType,
      notes: notes || null,
      patient: patientId
        ? { connect: { id: patientId } }
        : { create: patientCreateData },
      ...(reachOutType === "AGENCY" && agencyId
        ? { agency: { connect: { id: agencyId } } }
        : {}),
      ...(assignedToId ? { assignedTo: { connect: { id: assignedToId } } } : {}),
      ...(attendantCreateData ? { attendant: { create: attendantCreateData } } : {}),
    },
    include: CASE_DETAIL_INCLUDE,
  });
};

/**
 * @param {string} caseId
 * @param {Object} data - flat patient* fields, hasAttendant + flat attendant* fields,
 *   agencyId, assignedToId, notes. patientId/reachOutType are rejected if present and
 *   different from the existing case.
 */
export const updateCase = async (caseId, data) => {
  const existing = await Prisma.case.findUnique({
    where: { id: caseId },
    include: { attendant: true },
  });
  if (!existing) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }

  if (data.patientId !== undefined && data.patientId !== existing.patientId) {
    throw new AppError(
      "patientId cannot be changed after case creation",
      400,
      "VALIDATION_ERROR",
    );
  }
  if (data.reachOutType !== undefined && data.reachOutType !== existing.reachOutType) {
    throw new AppError(
      "reachOutType cannot be changed after case creation",
      400,
      "VALIDATION_ERROR",
    );
  }

  const caseUpdateData = {};

  if (data.agencyId !== undefined) {
    if (existing.reachOutType === "AGENCY" && !data.agencyId) {
      throw new AppError(
        "agencyId is required for agency-sourced cases",
        400,
        "VALIDATION_ERROR",
      );
    }
    if (data.agencyId) {
      const agency = await Prisma.agency.findUnique({ where: { id: data.agencyId } });
      if (!agency) throw new AppError("Agency not found", 404, "NOT_FOUND");
    }
    caseUpdateData.agencyId = existing.reachOutType === "AGENCY" ? data.agencyId : null;
  }

  if (data.assignedToId !== undefined) {
    if (data.assignedToId) {
      const assignee = await Prisma.user.findUnique({ where: { id: data.assignedToId } });
      if (!assignee) throw new AppError("Assigned user not found", 404, "NOT_FOUND");
    }
    caseUpdateData.assignedToId = data.assignedToId || null;
  }

  if (data.notes !== undefined) caseUpdateData.notes = data.notes || null;

  const patientUpdateData = pickFields(data, PATIENT_FIELDS);
  if (Object.keys(patientUpdateData).length > 0) {
    await Prisma.patient.update({
      where: { id: existing.patientId },
      data: patientUpdateData,
    });
  }

  if (existing.attendant && data.hasAttendant !== false) {
    const attendantUpdateData = pickAttendantFields(data);
    if (Object.keys(attendantUpdateData).length > 0) {
      await Prisma.attendant.update({
        where: { caseId },
        data: attendantUpdateData,
      });
    }
  }

  const updated = await Prisma.case.update({
    where: { id: caseId },
    data: caseUpdateData,
    include: CASE_DETAIL_INCLUDE,
  });

  return updated;
};

/**
 * @param {string} caseId
 * @param {{ hospitalId: string, notes?: string }} data
 */
export const sendInquiry = async (caseId, data) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (kase.status === "CANCELLED") {
    throw new AppError("Cannot send an inquiry for a cancelled case", 400, "VALIDATION_ERROR");
  }

  const { hospitalId, notes } = data;
  if (!hospitalId) {
    throw new AppError("hospitalId is required", 400, "VALIDATION_ERROR");
  }

  const hospital = await Prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) {
    throw new AppError("Hospital not found", 404, "NOT_FOUND");
  }

  const pending = await Prisma.hospitalInquiry.findFirst({
    where: { caseId, status: "PENDING" },
  });
  if (pending) {
    throw new AppError(
      "This case already has a pending inquiry. Wait for a response before sending another.",
      409,
      "CONFLICT",
    );
  }

  const [inquiry] = await Prisma.$transaction([
    Prisma.hospitalInquiry.create({
      data: { caseId, hospitalId, notes: notes || null },
      include: { hospital: true },
    }),
    Prisma.case.update({
      where: { id: caseId },
      data: { status: "HOSPITAL_MATCHING" },
    }),
  ]);

  return inquiry;
};

/**
 * @param {string} caseId
 * @param {string} inquiryId
 * @param {{ status: "ACCEPTED" | "DECLINED", treatmentCostEstimate?: number, currency?: string, notes?: string }} data
 */
export const respondToInquiry = async (caseId, inquiryId, data) => {
  const inquiry = await Prisma.hospitalInquiry.findUnique({ where: { id: inquiryId } });
  if (!inquiry || inquiry.caseId !== caseId) {
    throw new AppError("Hospital inquiry not found", 404, "NOT_FOUND");
  }
  if (inquiry.status !== "PENDING") {
    throw new AppError("This inquiry has already been responded to", 400, "VALIDATION_ERROR");
  }

  const { status, treatmentCostEstimate, currency, notes } = data;
  if (!["ACCEPTED", "DECLINED"].includes(status)) {
    throw new AppError("status must be ACCEPTED or DECLINED", 400, "VALIDATION_ERROR");
  }
  if (
    treatmentCostEstimate !== undefined &&
    treatmentCostEstimate !== null &&
    treatmentCostEstimate !== "" &&
    !currency
  ) {
    throw new AppError(
      "currency is required when treatmentCostEstimate is provided",
      400,
      "VALIDATION_ERROR",
    );
  }

  const caseStatus = status === "ACCEPTED" ? "HOSPITAL_ACCEPTED" : "HOSPITAL_DECLINED";

  const [updatedInquiry] = await Prisma.$transaction([
    Prisma.hospitalInquiry.update({
      where: { id: inquiryId },
      data: {
        status,
        treatmentCostEstimate:
          treatmentCostEstimate !== undefined && treatmentCostEstimate !== ""
            ? treatmentCostEstimate
            : undefined,
        currency: currency || undefined,
        notes: notes !== undefined ? notes || null : undefined,
        respondedAt: new Date(),
      },
      include: { hospital: true },
    }),
    Prisma.case.update({
      where: { id: caseId },
      data: { status: caseStatus },
    }),
  ]);

  return updatedInquiry;
};

/**
 * @param {string} caseId
 */
export const cancelCase = async (caseId) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (kase.status === "CANCELLED") {
    throw new AppError("This case is already cancelled", 400, "VALIDATION_ERROR");
  }

  return Prisma.case.update({
    where: { id: caseId },
    data: { status: "CANCELLED" },
    include: CASE_DETAIL_INCLUDE,
  });
};
