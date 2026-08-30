import crypto from "crypto";
import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import { generateCaseNumber } from "../../Config/Generators/ID/customCaseIdGenerator.js";
import { saveDocumentLocal } from "../../Utils/Documents/saveDocumentLocal.js";
import {
  assertNonNegativeAmount,
  assertPositiveAmount,
} from "../../Utils/Validation/assertAmount.js";
import { EMBASSY_PARTNERSHIP_COMMISSION_CATEGORY } from "../Expenses/expensesService.js";

/**
 * Agency-sourced cases don't get their VisaApplication rows auto-created on
 * hospital acceptance — those are created lazily later in the workflow.
 * @param {{ reachOutType?: string }} kase
 */
export const isAgencyCase = (kase) => kase.reachOutType === "AGENCY";

/**
 * Builds a `Prisma.caseEvent.create(...)` op for inclusion in a `$transaction`
 * array — Case/VisaApplication/HospitalInquiry only ever store their *current*
 * status, so this is the only record of "moved from X to Y, when, by whom".
 * @param {{ caseId: string, type: "CASE_CREATED"|"CASE_STATUS_CHANGED"|"VISA_STATUS_CHANGED"|"INQUIRY_STATUS_CHANGED", fromStatus?: string|null, toStatus: string, visaApplicationId?: string, inquiryId?: string, actorId?: string|null }} params
 */
const caseEventOp = ({ caseId, type, fromStatus, toStatus, visaApplicationId, inquiryId, actorId }) =>
  Prisma.caseEvent.create({
    data: {
      caseId,
      type,
      fromStatus: fromStatus ?? null,
      toStatus,
      visaApplicationId: visaApplicationId ?? null,
      inquiryId: inquiryId ?? null,
      actorId: actorId ?? null,
    },
  });

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
    include: {
      hospital: true,
      documents: { orderBy: { createdAt: "desc" } },
    },
  },
  visaApplications: {
    orderBy: { createdAt: "asc" },
    include: {
      payment: {
        include: { refunds: { orderBy: { refundedAt: "desc" } } },
      },
    },
  },
  documents: {
    orderBy: { createdAt: "desc" },
  },
  expenses: {
    orderBy: { incurredAt: "desc" },
    include: {
      paidBy: { select: { id: true, firstName: true, lastName: true } },
      accountTransaction: { select: { account: { select: { id: true, name: true } } } },
    },
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

// passportNumber / passportExpiry are intentionally absent: the passport is now
// captured as an uploaded PATIENT_PASSPORT document at case registration, and both
// columns are nullable in the schema. They stay in PATIENT_FIELDS so a client may
// still supply them, but they are no longer mandatory on the typed form.
const PATIENT_REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "nationality",
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
const DATE_ONLY_FIELDS = new Set(["dateOfBirth", "passportExpiry", "embassyVisitDate"]);
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

const PATIENT_SEARCH_MIN_LENGTH = 2;

// A case can only accept a NEW hospital inquiry in these statuses. Once accepted,
// its VisaApplication(s) already exist — a second accepted inquiry would attempt to
// create duplicate rows and crash on VisaApplication's @@unique([caseId,
// travelerType]) constraint instead of failing cleanly.
const SENDABLE_CASE_STATUSES = ["NEW", "HOSPITAL_MATCHING", "HOSPITAL_DECLINED"];

/**
 * Reuse-lookup for an existing patient. Matches the term against passport number,
 * first name, last name, or phone — passport number is now optional, so a
 * number-less patient must still be findable by name/phone.
 * @param {string} term
 */
export const searchPatients = async (term) => {
  const trimmed = term?.trim();
  if (!trimmed) {
    throw new AppError(
      "search term query param is required",
      400,
      "VALIDATION_ERROR",
    );
  }
  if (trimmed.length < PATIENT_SEARCH_MIN_LENGTH) {
    throw new AppError(
      `search term must be at least ${PATIENT_SEARCH_MIN_LENGTH} characters`,
      400,
      "VALIDATION_ERROR",
    );
  }

  const patients = await Prisma.patient.findMany({
    where: {
      OR: [
        { passportNumber: { contains: trimmed, mode: "insensitive" } },
        { firstName: { contains: trimmed, mode: "insensitive" } },
        { lastName: { contains: trimmed, mode: "insensitive" } },
        { phone: { contains: trimmed } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, firstName: true, lastName: true, passportNumber: true },
  });

  if (patients.length === 0) return [];

  const passportDocs = await Prisma.document.findMany({
    where: {
      type: "PATIENT_PASSPORT",
      case: { patientId: { in: patients.map((p) => p.id) } },
    },
    select: { case: { select: { patientId: true } } },
  });
  const withPassport = new Set(passportDocs.map((d) => d.case.patientId));

  return patients.map((p) => ({ ...p, hasPassportOnFile: withPassport.has(p.id) }));
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
 * @param {{ patientPassport?: object[], caseDocument?: object[], attendantPassport?: object[] }} files -
 *   the Multer `.fields()` object; each value is `[{ buffer, mimetype, originalname }]`. Pass `{}` for none.
 * @param {string} userId
 */
export const createCase = async (data, files, userId) => {
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

  // Multer passes every multipart field through as a string, so `hasAttendant`
  // arrives as "false"/"true" over HTTP — both truthy. Coerce to a real boolean
  // before the guard so an attendant-less case isn't forced through attendant
  // creation/validation.
  const hasAttendant = data.hasAttendant === true || data.hasAttendant === "true";

  let attendantCreateData = null;
  if (hasAttendant) {
    attendantCreateData = pickAttendantFields(data);
    assertAttendantRequiredFields(attendantCreateData);
  }

  // --- Document requirements (before any write) ---
  let patientPassportRequired = true;
  if (patientId) {
    const priorPassport = await Prisma.document.findFirst({
      where: { case: { patientId }, type: "PATIENT_PASSPORT" },
    });
    if (priorPassport) patientPassportRequired = false;
  }
  const patientPassportFile = files?.patientPassport?.[0] ?? null;
  const caseDocumentFile = files?.caseDocument?.[0] ?? null;
  const attendantPassportFile = files?.attendantPassport?.[0] ?? null;

  if (patientPassportRequired && !patientPassportFile) {
    throw new AppError("Patient passport is required", 400, "VALIDATION_ERROR");
  }
  if (!caseDocumentFile) {
    throw new AppError("Case document is required", 400, "VALIDATION_ERROR");
  }

  const caseNumber = await generateCaseNumber();

  const docPlan = [
    [patientPassportFile, "PATIENT_PASSPORT"],
    [caseDocumentFile, "CASE_DOCUMENT"],
    // Only keep an attendant-passport file when the case actually has an attendant
    // — otherwise a stray upload on a no-attendant case would be stored.
    [attendantCreateData ? attendantPassportFile : null, "ATTENDANT_PASSPORT"],
  ].filter(([file]) => file);

  // NOTE: `patient` below uses nested relation syntax (`connect`/`create`), which
  // forces Prisma's "checked" create-input shape for this call — that shape does not
  // accept raw scalar FK fields (`agencyId`/`assignedToId`) alongside it, only nested
  // `agency`/`assignedTo` relation objects. Using `connect` here keeps the same
  // semantics as plain scalar assignment while satisfying Prisma's input validation.
  //
  // The case row and its Document rows are written in one transaction: a failed
  // document write (e.g. an unsupported mime type) rolls the whole case back.
  // `timeout` is raised well above Prisma's 5s default because `saveDocumentLocal`
  // does disk I/O inside the transaction and each upload can be up to 50MB.
  return Prisma.$transaction(async (tx) => {
    const created = await tx.case.create({
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
        events: { create: { type: "CASE_CREATED", toStatus: "NEW", actorId: userId ?? null } },
      },
    });

    for (const [file, type] of docPlan) {
      const documentId = crypto.randomUUID();
      const fileUrl = await saveDocumentLocal(file.buffer, created.id, documentId, file.mimetype);
      await tx.document.create({
        data: {
          id: documentId,
          caseId: created.id,
          type,
          fileName: file.originalname,
          fileUrl,
          uploadedById: userId,
        },
      });
    }

    return tx.case.findUnique({ where: { id: created.id }, include: CASE_DETAIL_INCLUDE });
  }, { timeout: 30000 });
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
  // Nullable optional patient fields: an explicit "" from the client means "clear
  // this field", which Prisma expects as `null` rather than a literal empty string.
  for (const field of ["email", "address"]) {
    if (patientUpdateData[field] === "") patientUpdateData[field] = null;
  }
  if (Object.keys(patientUpdateData).length > 0) {
    // Reject only required fields that are actually present in this update payload
    // and falsy/empty — not "all required fields must be present" — so a partial
    // API update that doesn't touch a given required field isn't spuriously
    // rejected. In practice the frontend always sends the full form state, so this
    // validates the whole required set on every real edit.
    for (const field of PATIENT_REQUIRED_FIELDS) {
      if (field in patientUpdateData && !patientUpdateData[field]) {
        throw new AppError(`Patient ${field} is required`, 400, "VALIDATION_ERROR");
      }
    }
  }

  let attendantUpdateData = null;
  if (existing.attendant && data.hasAttendant !== false) {
    const picked = pickAttendantFields(data);
    if (Object.keys(picked).length > 0) attendantUpdateData = picked;
  }

  // Run every write for this update as one atomic transaction — a failure partway
  // through (e.g. the case update) must not leave the patient/attendant rows updated
  // while the case itself is untouched. The case update stays last so its result
  // (with CASE_DETAIL_INCLUDE) is the one we return.
  const transactionOps = [];
  if (Object.keys(patientUpdateData).length > 0) {
    transactionOps.push(
      Prisma.patient.update({
        where: { id: existing.patientId },
        data: patientUpdateData,
      }),
    );
  }
  if (attendantUpdateData) {
    transactionOps.push(
      Prisma.attendant.update({
        where: { caseId },
        data: attendantUpdateData,
      }),
    );
  }
  transactionOps.push(
    Prisma.case.update({
      where: { id: caseId },
      data: caseUpdateData,
      include: CASE_DETAIL_INCLUDE,
    }),
  );

  const results = await Prisma.$transaction(transactionOps);
  return results[results.length - 1];
};

/**
 * @param {string} caseId
 * @param {{ hospitalId: string, notes?: string }} data
 * @param {string} userId
 */
export const sendInquiry = async (caseId, data, userId) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (!SENDABLE_CASE_STATUSES.includes(kase.status)) {
    throw new AppError(
      "This case cannot accept a new hospital inquiry in its current status",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { hospitalId, notes } = data;
  if (!hospitalId) {
    throw new AppError("hospitalId is required", 400, "VALIDATION_ERROR");
  }

  const hospital = await Prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) {
    throw new AppError("Hospital not found", 404, "NOT_FOUND");
  }

  const dupe = await Prisma.hospitalInquiry.findFirst({
    where: { caseId, hospitalId, status: "PENDING" },
  });
  if (dupe) {
    throw new AppError(
      "This case already has a pending inquiry to this hospital.",
      409,
      "CONFLICT",
    );
  }

  const ops = [
    Prisma.hospitalInquiry.create({
      data: { caseId, hospitalId, notes: notes || null },
      include: { hospital: true },
    }),
  ];

  // Only move the case (and log the audit event) on the real transition into
  // HOSPITAL_MATCHING. A 2nd+ concurrent inquiry leaves the case already in
  // HOSPITAL_MATCHING, so skip the no-op update/event.
  if (kase.status !== "HOSPITAL_MATCHING") {
    ops.push(
      Prisma.case.update({
        where: { id: caseId },
        data: { status: "HOSPITAL_MATCHING" },
      }),
      caseEventOp({
        caseId,
        type: "CASE_STATUS_CHANGED",
        fromStatus: kase.status,
        toStatus: "HOSPITAL_MATCHING",
        actorId: userId,
      }),
    );
  }

  const [inquiry] = await Prisma.$transaction(ops);

  return inquiry;
};

/**
 * @param {string} caseId
 * @param {string} inquiryId
 * @param {{ status?: "DECLINED", notes?: string }} data
 * @param {string} userId
 */
export const respondToInquiry = async (caseId, inquiryId, data, userId) => {
  const kase = await Prisma.case.findUnique({
    where: { id: caseId },
    include: { attendant: true },
  });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (kase.status === "CANCELLED") {
    throw new AppError(
      "Cannot respond to an inquiry for a cancelled case",
      400,
      "VALIDATION_ERROR",
    );
  }

  const inquiry = await Prisma.hospitalInquiry.findUnique({ where: { id: inquiryId } });
  if (!inquiry || inquiry.caseId !== caseId) {
    throw new AppError("Hospital inquiry not found", 404, "NOT_FOUND");
  }
  if (inquiry.status !== "PENDING") {
    throw new AppError("This inquiry has already been responded to", 400, "VALIDATION_ERROR");
  }

  const { status, notes } = data;
  if (status !== undefined && status !== "DECLINED") {
    throw new AppError(
      "Only a decline can be recorded here — use the record-response action to choose a hospital.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const remainingPending = await Prisma.hospitalInquiry.count({
    where: { caseId, status: "PENDING", id: { not: inquiryId } },
  });
  const caseGoesDeclined =
    remainingPending === 0 &&
    !(await Prisma.hospitalInquiry.findFirst({ where: { caseId, isChosen: true } }));

  const ops = [
    Prisma.hospitalInquiry.update({
      where: { id: inquiryId },
      data: {
        status: "DECLINED",
        notes: notes !== undefined ? notes || null : undefined,
        respondedAt: new Date(),
      },
      include: { hospital: true },
    }),
    caseEventOp({
      caseId,
      type: "INQUIRY_STATUS_CHANGED",
      fromStatus: "PENDING",
      toStatus: "DECLINED",
      inquiryId,
      actorId: userId,
    }),
  ];
  if (caseGoesDeclined) {
    ops.push(
      Prisma.case.update({ where: { id: caseId }, data: { status: "HOSPITAL_DECLINED" } }),
      caseEventOp({
        caseId,
        type: "CASE_STATUS_CHANGED",
        fromStatus: kase.status,
        toStatus: "HOSPITAL_DECLINED",
        actorId: userId,
      }),
    );
  }

  const [updatedInquiry] = await Prisma.$transaction(ops);
  return updatedInquiry;
};

const CURRENCIES = ["USD", "INR"];

/**
 * Records the chosen hospital's response — the case-advancing trigger.
 * @param {string} caseId
 * @param {string} inquiryId
 * @param {{ treatmentCostEstimate: number|string, currency: string, notes?: string }} data
 * @param {{ evaluationDoc?: {buffer,mimetype,originalname}[], invitationLetter?: {buffer,mimetype,originalname}[] }} files
 * @param {string} userId
 */
export const recordChosenResponse = async (caseId, inquiryId, data, files, userId) => {
  const kase = await Prisma.case.findUnique({
    where: { id: caseId },
    include: { attendant: true },
  });
  if (!kase) throw new AppError("Case not found", 404, "NOT_FOUND");
  if (kase.status === "CANCELLED") {
    throw new AppError("Cannot record a response for a cancelled case", 400, "VALIDATION_ERROR");
  }

  const inquiry = await Prisma.hospitalInquiry.findUnique({ where: { id: inquiryId } });
  if (!inquiry || inquiry.caseId !== caseId) {
    throw new AppError("Hospital inquiry not found", 404, "NOT_FOUND");
  }

  const alreadyChosen = await Prisma.hospitalInquiry.findFirst({ where: { caseId, isChosen: true } });
  if (alreadyChosen) {
    throw new AppError(
      "This case already has a chosen hospital. Use the change-hospital action instead.",
      400,
      "VALIDATION_ERROR",
    );
  }

  if (inquiry.status !== "PENDING") {
    throw new AppError("This inquiry is no longer pending", 400, "VALIDATION_ERROR");
  }

  const { treatmentCostEstimate, currency, notes } = data;
  assertPositiveAmount(treatmentCostEstimate, "A positive treatment cost estimate is required");
  if (!CURRENCIES.includes(currency)) {
    throw new AppError(`currency must be one of: ${CURRENCIES.join(", ")}`, 400, "VALIDATION_ERROR");
  }
  const evaluationDoc = files?.evaluationDoc?.[0] ?? null;
  const invitationLetter = files?.invitationLetter?.[0] ?? null;
  if (!evaluationDoc) throw new AppError("An evaluation document is required", 400, "VALIDATION_ERROR");
  if (!invitationLetter) throw new AppError("An invitation letter is required", 400, "VALIDATION_ERROR");

  const docPlan = [
    [evaluationDoc, "EVALUATION_DOC"],
    [invitationLetter, "INVITATION_LETTER"],
  ];

  return Prisma.$transaction(async (tx) => {
    await tx.hospitalInquiry.update({
      where: { id: inquiryId },
      data: {
        status: "ACCEPTED",
        isChosen: true,
        treatmentCostEstimate,
        currency,
        notes: notes !== undefined ? notes || null : undefined,
        respondedAt: new Date(),
      },
    });

    await tx.hospitalInquiry.updateMany({
      where: { caseId, status: "PENDING", id: { not: inquiryId } },
      data: { status: "NOT_SELECTED", respondedAt: new Date() },
    });

    for (const [file, type] of docPlan) {
      const documentId = crypto.randomUUID();
      const fileUrl = await saveDocumentLocal(file.buffer, caseId, documentId, file.mimetype);
      await tx.document.create({
        data: {
          id: documentId,
          caseId,
          hospitalInquiryId: inquiryId,
          type,
          fileName: file.originalname,
          fileUrl,
          uploadedById: userId,
        },
      });
    }

    await tx.case.update({ where: { id: caseId }, data: { status: "HOSPITAL_ACCEPTED" } });

    await tx.caseEvent.create({
      data: { caseId, type: "CASE_STATUS_CHANGED", fromStatus: kase.status, toStatus: "HOSPITAL_ACCEPTED", actorId: userId },
    });
    await tx.caseEvent.create({
      data: { caseId, type: "HOSPITAL_CHOSEN", fromStatus: null, toStatus: "ACCEPTED", inquiryId, actorId: userId },
    });

    if (!isAgencyCase(kase)) {
      await tx.visaApplication.create({ data: { caseId, travelerType: "PATIENT" } });
      if (kase.attendant) {
        await tx.visaApplication.create({ data: { caseId, travelerType: "ATTENDANT" } });
      }
    }

    return tx.case.findUnique({ where: { id: caseId }, include: CASE_DETAIL_INCLUDE });
  }, { timeout: 30000 });
};

/**
 * Re-points a case's chosen hospital — allowed only until the first visa fee is paid.
 * @param {string} caseId
 * @param {string} newInquiryId
 * @param {{ treatmentCostEstimate: number|string, currency: string, notes?: string }} data
 * @param {{ evaluationDoc?: {buffer,mimetype,originalname}[], invitationLetter?: {buffer,mimetype,originalname}[] }} files
 * @param {string} userId
 */
export const changeChosenHospital = async (caseId, newInquiryId, data, files, userId) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) throw new AppError("Case not found", 404, "NOT_FOUND");
  if (kase.status === "CANCELLED") throw new AppError("This case has been cancelled", 400, "VALIDATION_ERROR");

  const current = await Prisma.hospitalInquiry.findFirst({ where: { caseId, isChosen: true } });
  if (!current) throw new AppError("This case has no chosen hospital yet", 400, "VALIDATION_ERROR");

  const paid = await Prisma.payment.findFirst({ where: { visaApplication: { caseId } } });
  if (paid) throw new AppError("The hospital cannot be changed after a visa fee has been paid", 400, "VALIDATION_ERROR");

  const next = await Prisma.hospitalInquiry.findUnique({ where: { id: newInquiryId } });
  if (!next || next.caseId !== caseId) throw new AppError("Hospital inquiry not found", 404, "NOT_FOUND");
  if (next.id === current.id) throw new AppError("That hospital is already the chosen one", 400, "VALIDATION_ERROR");
  if (!["PENDING", "NOT_SELECTED"].includes(next.status)) {
    throw new AppError("That inquiry cannot be chosen", 400, "VALIDATION_ERROR");
  }

  const { treatmentCostEstimate, currency, notes } = data;
  assertPositiveAmount(treatmentCostEstimate, "A positive treatment cost estimate is required");
  if (!CURRENCIES.includes(currency)) throw new AppError(`currency must be one of: ${CURRENCIES.join(", ")}`, 400, "VALIDATION_ERROR");
  const evaluationDoc = files?.evaluationDoc?.[0] ?? null;
  const invitationLetter = files?.invitationLetter?.[0] ?? null;
  if (!evaluationDoc) throw new AppError("An evaluation document is required", 400, "VALIDATION_ERROR");
  if (!invitationLetter) throw new AppError("An invitation letter is required", 400, "VALIDATION_ERROR");

  return Prisma.$transaction(async (tx) => {
    await tx.hospitalInquiry.update({ where: { id: current.id }, data: { isChosen: false, status: "NOT_SELECTED" } });
    await tx.hospitalInquiry.update({
      where: { id: next.id },
      data: {
        isChosen: true,
        status: "ACCEPTED",
        treatmentCostEstimate,
        currency,
        // An omitted `notes` leaves the target inquiry's existing note alone;
        // an explicit empty string clears it (same contract as recordChosenResponse).
        notes: notes !== undefined ? notes || null : undefined,
        respondedAt: new Date(),
      },
    });
    for (const [file, type] of [[evaluationDoc, "EVALUATION_DOC"], [invitationLetter, "INVITATION_LETTER"]]) {
      const documentId = crypto.randomUUID();
      const fileUrl = await saveDocumentLocal(file.buffer, caseId, documentId, file.mimetype);
      await tx.document.create({
        data: { id: documentId, caseId, hospitalInquiryId: next.id, type, fileName: file.originalname, fileUrl, uploadedById: userId },
      });
    }
    await tx.caseEvent.create({
      data: { caseId, type: "HOSPITAL_CHANGED", fromStatus: null, toStatus: "ACCEPTED", inquiryId: next.id, actorId: userId },
    });
    return tx.case.findUnique({ where: { id: caseId }, include: CASE_DETAIL_INCLUDE });
  }, { timeout: 30000 });
};

/**
 * @param {string} caseId
 * @param {string} userId
 */
export const cancelCase = async (caseId, userId) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (kase.status === "CANCELLED") {
    throw new AppError("This case is already cancelled", 400, "VALIDATION_ERROR");
  }

  // Cancelling a case must not leave a dangling PENDING inquiry that could still be
  // responded to later and un-cancel the case's effective state — close out any
  // pending inquiries in the same transaction as the case cancellation.
  const [, updatedCase] = await Prisma.$transaction([
    Prisma.hospitalInquiry.updateMany({
      where: { caseId, status: "PENDING" },
      data: { status: "DECLINED", respondedAt: new Date() },
    }),
    Prisma.case.update({
      where: { id: caseId },
      data: { status: "CANCELLED" },
      include: CASE_DETAIL_INCLUDE,
    }),
    caseEventOp({
      caseId,
      type: "CASE_STATUS_CHANGED",
      fromStatus: kase.status,
      toStatus: "CANCELLED",
      actorId: userId,
    }),
  ]);

  return updatedCase;
};

const TERMINAL_VISA_STATUSES = ["APPROVED", "REJECTED"];

// A case can only have a fee payment recorded once a hospital has accepted it —
// this keeps the visa step ordered after hospital matching for agency cases too
// (whose visa applications are created lazily by recordFeePaymentByTraveler).
const FEE_PAYABLE_CASE_STATUSES = ["HOSPITAL_ACCEPTED", "VISA_PROCESSING"];

/**
 * Validates the money side of a fee payment. Called by recordFeePayment and,
 * ahead of the lazy VisaApplication create, by recordFeePaymentByTraveler — so a
 * doomed request never persists a stray PENDING visa application.
 * @param {{ accountId?: string, amount?: number|string }} data
 */
const assertFeePaymentAccountAndAmount = async ({ accountId, amount }) => {
  if (!accountId) {
    throw new AppError("accountId is required", 400, "VALIDATION_ERROR");
  }
  if (amount === undefined || amount === null || amount === "" || Number(amount) <= 0) {
    throw new AppError("amount must be a positive number", 400, "VALIDATION_ERROR");
  }
  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new AppError("Account not found", 404, "NOT_FOUND");
  }
};

/**
 * @param {string} caseId
 * @param {string} visaApplicationId
 * @param {{ accountId: string, amount: number|string, notes?: string }} data
 * @param {string} userId
 */
export const recordFeePayment = async (caseId, visaApplicationId, data, userId) => {
  const visaApplication = await Prisma.visaApplication.findUnique({
    where: { id: visaApplicationId },
  });
  if (!visaApplication || visaApplication.caseId !== caseId) {
    throw new AppError("Visa application not found", 404, "NOT_FOUND");
  }

  const kase = await Prisma.case.findUnique({
    where: { id: caseId },
    include: { attendant: true },
  });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (kase.status === "CANCELLED") {
    throw new AppError("This case has been cancelled", 400, "VALIDATION_ERROR");
  }

  if (!isAgencyCase(kase) && kase.attendant) {
    const attendantPassport = await Prisma.document.findFirst({
      where: { caseId, type: "ATTENDANT_PASSPORT" },
    });
    if (!attendantPassport) {
      throw new AppError(
        "Attendant passport must be uploaded before visa processing",
        400,
        "VALIDATION_ERROR",
      );
    }
  }

  if (visaApplication.status !== "PENDING") {
    throw new AppError(
      "This visa application's fee has already been recorded",
      400,
      "VALIDATION_ERROR",
    );
  }

  await assertFeePaymentAccountAndAmount(data);
  const { accountId, amount, notes } = data;

  // Case.status only moves to VISA_PROCESSING on this case's *first* fee payment —
  // check before creating this one, since after this transaction there will always
  // be at least one.
  const alreadyHasPayment = await Prisma.payment.findFirst({
    where: { visaApplication: { caseId } },
  });
  const isFirstPayment = !alreadyHasPayment;

  // NOTE: nesting `accountTransaction: { create }` under this call forces Prisma's
  // "checked" create-input shape (same issue already documented in this codebase's
  // `createCase`) — that shape rejects raw scalar FKs (`visaApplicationId`,
  // `receivedById`) as siblings of a nested relation write, so both must use
  // `connect` here too. The nested `accountTransaction.create` object itself has no
  // sibling nested relation, so `accountId`/`createdById` stay as plain scalars
  // there.
  const transactionOps = [
    Prisma.payment.create({
      data: {
        visaApplication: { connect: { id: visaApplicationId } },
        amount,
        currency: "USD",
        feeType: kase.reachOutType,
        receivedBy: { connect: { id: userId } },
        accountTransaction: {
          create: {
            accountId,
            type: "PAYMENT_RECEIVED",
            amount,
            currency: "USD",
            notes: notes || null,
            createdById: userId,
          },
        },
      },
    }),
    Prisma.visaApplication.update({
      where: { id: visaApplicationId },
      data: { status: "FEE_PAID" },
      include: { payment: true },
    }),
    caseEventOp({
      caseId,
      type: "VISA_STATUS_CHANGED",
      fromStatus: visaApplication.status,
      toStatus: "FEE_PAID",
      visaApplicationId,
      actorId: userId,
    }),
  ];
  if (isFirstPayment) {
    transactionOps.push(
      Prisma.case.update({
        where: { id: caseId },
        data: { status: "VISA_PROCESSING" },
      }),
      caseEventOp({
        caseId,
        type: "CASE_STATUS_CHANGED",
        fromStatus: kase.status,
        toStatus: "VISA_PROCESSING",
        actorId: userId,
      }),
    );
  }

  const [, updatedVisaApplication] = await Prisma.$transaction(transactionOps);
  return updatedVisaApplication;
};

/**
 * Fee payment addressed by traveler type rather than a known VisaApplication id.
 * Used for agency cases, whose visa applications are created lazily (they are not
 * auto-created on hospital acceptance). Delegates to recordFeePayment once the
 * VisaApplication is resolved.
 * @param {string} caseId
 * @param {{ travelerType: "PATIENT"|"ATTENDANT", accountId: string, amount: number|string, notes?: string }} data
 * @param {string} userId
 */
export const recordFeePaymentByTraveler = async (caseId, data, userId) => {
  const { travelerType } = data;
  if (!["PATIENT", "ATTENDANT"].includes(travelerType)) {
    throw new AppError("travelerType must be PATIENT or ATTENDANT", 400, "VALIDATION_ERROR");
  }

  const kase = await Prisma.case.findUnique({
    where: { id: caseId },
    include: { attendant: true },
  });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (travelerType === "ATTENDANT" && !kase.attendant) {
    throw new AppError("This case has no attendant", 400, "VALIDATION_ERROR");
  }

  let visaApplication = await Prisma.visaApplication.findUnique({
    where: { caseId_travelerType: { caseId, travelerType } },
  });
  if (!visaApplication) {
    if (!isAgencyCase(kase)) {
      throw new AppError(
        "No visa application exists for this traveler yet",
        400,
        "VALIDATION_ERROR",
      );
    }
    // Guard the lazy create: an agency case must have had a hospital accept it
    // (status HOSPITAL_ACCEPTED / VISA_PROCESSING) before any visa fee — otherwise
    // an API caller with MANAGE_FINANCE could push a NEW / HOSPITAL_MATCHING case
    // straight to VISA_PROCESSING, skipping hospital matching. (CANCELLED is not
    // in the list either.)
    if (!FEE_PAYABLE_CASE_STATUSES.includes(kase.status)) {
      throw new AppError(
        "Fee payment can only be recorded after a hospital has accepted the case",
        400,
        "VALIDATION_ERROR",
      );
    }
    // Validate the money side BEFORE the create, so a doomed request (bad
    // accountId / amount) never leaves a stray PENDING visa application.
    await assertFeePaymentAccountAndAmount(data);
    visaApplication = await Prisma.visaApplication.create({
      data: { caseId, travelerType },
    });
  }

  return recordFeePayment(caseId, visaApplication.id, data, userId);
};

/**
 * @param {string} caseId
 * @param {string} visaApplicationId
 * @param {{ embassyVisitDate: string, notes?: string }} data
 * @param {string} userId
 */
export const markEmbassyVisited = async (caseId, visaApplicationId, data, userId) => {
  const visaApplication = await Prisma.visaApplication.findUnique({
    where: { id: visaApplicationId },
  });
  if (!visaApplication || visaApplication.caseId !== caseId) {
    throw new AppError("Visa application not found", 404, "NOT_FOUND");
  }

  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (kase.status === "CANCELLED") {
    throw new AppError("This case has been cancelled", 400, "VALIDATION_ERROR");
  }

  if (visaApplication.status !== "FEE_PAID") {
    throw new AppError(
      "The visa-registration fee must be paid before recording an embassy visit",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { embassyVisitDate, notes } = data;
  if (!embassyVisitDate) {
    throw new AppError("embassyVisitDate is required", 400, "VALIDATION_ERROR");
  }

  const commission = data.partnerCommission;
  let commissionAccount = null;
  // The commission is optional: an absent block, or a blank/zero amount, skips it.
  // A supplied-but-non-numeric (or negative) amount is a client error, not a silent skip.
  if (commission && commission.amount !== undefined && commission.amount !== null && commission.amount !== "") {
    assertNonNegativeAmount(
      commission.amount,
      "partnerCommission.amount must be zero or a positive number",
    );
    if (Number(commission.amount) > 0) {
      if (!commission.accountId) throw new AppError("A commission account is required", 400, "VALIDATION_ERROR");
      commissionAccount = await Prisma.account.findUnique({ where: { id: commission.accountId } });
      if (!commissionAccount) throw new AppError("Commission account not found", 404, "NOT_FOUND");
    }
  }

  const [updated] = await Prisma.$transaction([
    Prisma.visaApplication.update({
      where: { id: visaApplicationId },
      data: {
        status: "EMBASSY_VISITED",
        embassyVisitDate: normalizeDateValue("embassyVisitDate", embassyVisitDate),
        notes: notes !== undefined ? notes || null : undefined,
      },
      include: { payment: true },
    }),
    caseEventOp({
      caseId,
      type: "VISA_STATUS_CHANGED",
      fromStatus: visaApplication.status,
      toStatus: "EMBASSY_VISITED",
      visaApplicationId,
      actorId: userId,
    }),
    ...(commissionAccount
      ? [
          Prisma.expense.create({
            data: {
              category: EMBASSY_PARTNERSHIP_COMMISSION_CATEGORY,
              amount: commission.amount,
              currency: "USD",
              case: { connect: { id: caseId } },
              visaApplication: { connect: { id: visaApplicationId } },
              paidBy: { connect: { id: userId } },
              accountTransaction: {
                create: {
                  accountId: commission.accountId,
                  type: "EXPENSE_PAID",
                  amount: commission.amount,
                  currency: "USD",
                  notes: "Embassy partnership commission",
                  createdById: userId,
                },
              },
            },
          }),
        ]
      : []),
  ]);
  return updated;
};

/**
 * @param {string} caseId
 * @param {string} visaApplicationId
 * @param {{ status: "APPROVED"|"REJECTED", visaNumber?: string, notes?: string }} data
 * @param {string} userId
 */
export const recordVisaOutcome = async (caseId, visaApplicationId, data, userId) => {
  const visaApplication = await Prisma.visaApplication.findUnique({
    where: { id: visaApplicationId },
  });
  if (!visaApplication || visaApplication.caseId !== caseId) {
    throw new AppError("Visa application not found", 404, "NOT_FOUND");
  }

  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (kase.status === "CANCELLED") {
    throw new AppError("This case has been cancelled", 400, "VALIDATION_ERROR");
  }

  if (visaApplication.status !== "EMBASSY_VISITED") {
    throw new AppError(
      "The embassy visit must be recorded before a visa outcome",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { status, visaNumber, notes } = data;
  if (!TERMINAL_VISA_STATUSES.includes(status)) {
    throw new AppError("status must be APPROVED or REJECTED", 400, "VALIDATION_ERROR");
  }
  if (status === "APPROVED" && !visaNumber?.trim()) {
    throw new AppError(
      "visaNumber is required when the visa is approved",
      400,
      "VALIDATION_ERROR",
    );
  }

  const siblingApplications = await Prisma.visaApplication.findMany({
    where: { caseId },
  });
  const allTerminalAfterThisUpdate = siblingApplications.every((app) =>
    app.id === visaApplicationId ? true : TERMINAL_VISA_STATUSES.includes(app.status),
  );

  const transactionOps = [
    Prisma.visaApplication.update({
      where: { id: visaApplicationId },
      data: {
        status,
        visaNumber: status === "APPROVED" ? visaNumber.trim() : undefined,
        notes: notes !== undefined ? notes || null : undefined,
      },
      include: { payment: true },
    }),
    caseEventOp({
      caseId,
      type: "VISA_STATUS_CHANGED",
      fromStatus: visaApplication.status,
      toStatus: status,
      visaApplicationId,
      actorId: userId,
    }),
  ];
  if (allTerminalAfterThisUpdate) {
    transactionOps.push(
      Prisma.case.update({
        where: { id: caseId },
        data: { status: "COMPLETED" },
      }),
      caseEventOp({
        caseId,
        type: "CASE_STATUS_CHANGED",
        fromStatus: kase.status,
        toStatus: "COMPLETED",
        actorId: userId,
      }),
    );
  }

  const [updatedVisaApplication] = await Prisma.$transaction(transactionOps);
  return updatedVisaApplication;
};

/**
 * A refund is issued against the payment already recorded for a visa
 * application. Deliberately has no cancelled-case guard (unlike the other
 * visa-application actions above) — refunding money already collected is a
 * normal thing to do *after* a case is cancelled.
 * @param {string} caseId
 * @param {string} visaApplicationId
 * @param {{ accountId: string, amount: number|string, reason: string }} data
 * @param {string} userId
 */
export const issueRefund = async (caseId, visaApplicationId, data, userId) => {
  const visaApplication = await Prisma.visaApplication.findUnique({
    where: { id: visaApplicationId },
    include: { payment: { include: { refunds: true } } },
  });
  if (!visaApplication || visaApplication.caseId !== caseId) {
    throw new AppError("Visa application not found", 404, "NOT_FOUND");
  }
  if (!visaApplication.payment) {
    throw new AppError(
      "No payment has been recorded for this visa application",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { accountId, amount, reason } = data;
  if (!accountId) {
    throw new AppError("accountId is required", 400, "VALIDATION_ERROR");
  }
  if (amount === undefined || amount === null || amount === "" || Number(amount) <= 0) {
    throw new AppError("amount must be a positive number", 400, "VALIDATION_ERROR");
  }
  if (!reason?.trim()) {
    throw new AppError("reason is required", 400, "VALIDATION_ERROR");
  }

  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new AppError("Account not found", 404, "NOT_FOUND");
  }

  const { payment } = visaApplication;
  const alreadyRefunded = payment.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
  const refundable = Number(payment.amount) - alreadyRefunded;
  if (Number(amount) > refundable) {
    throw new AppError(
      `amount cannot exceed the refundable balance of ${refundable}`,
      400,
      "VALIDATION_ERROR",
    );
  }

  // Same "checked" create-input shape gotcha as `recordFeePayment` — sibling
  // scalar FKs alongside a nested relation write must use `connect`.
  return Prisma.refund.create({
    data: {
      payment: { connect: { id: payment.id } },
      amount,
      reason: reason.trim(),
      refundedBy: { connect: { id: userId } },
      accountTransaction: {
        create: {
          accountId,
          type: "REFUND_ISSUED",
          amount,
          currency: payment.currency,
          createdById: userId,
        },
      },
    },
  });
};

const ACTOR_SELECT = { select: { id: true, firstName: true, lastName: true } };

/**
 * Merges everything timestamped on a case — status-change events, user notes,
 * payments, expenses, refunds, and document uploads — into one chronological
 * (oldest-first) feed. This is per-case and unbounded, unlike the dashboard's
 * global recent-activity feed (getRecentActivity in dashboardService.js),
 * which is capped and merges across *all* cases.
 * @param {string} caseId
 */
export const getCaseTimeline = async (caseId) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }

  const [events, notes, payments, expenses, refunds, documents, inquiries] = await Promise.all([
    Prisma.caseEvent.findMany({ where: { caseId }, include: { actor: ACTOR_SELECT } }),
    Prisma.caseNote.findMany({ where: { caseId }, include: { author: ACTOR_SELECT } }),
    Prisma.payment.findMany({
      where: { visaApplication: { caseId } },
      include: { receivedBy: ACTOR_SELECT, visaApplication: { select: { travelerType: true } } },
    }),
    Prisma.expense.findMany({ where: { caseId }, include: { paidBy: ACTOR_SELECT } }),
    Prisma.refund.findMany({
      where: { payment: { visaApplication: { caseId } } },
      include: {
        refundedBy: ACTOR_SELECT,
        payment: { select: { visaApplication: { select: { travelerType: true } } } },
      },
    }),
    Prisma.document.findMany({ where: { caseId }, include: { uploadedBy: ACTOR_SELECT } }),
    // CaseEvent stores inquiryId without a relation, so the hospital names for the
    // HOSPITAL_CHOSEN / HOSPITAL_CHANGED events are resolved with one extra lookup.
    Prisma.hospitalInquiry.findMany({
      where: { caseId },
      select: { id: true, hospital: { select: { name: true } } },
    }),
  ]);

  const hospitalNameByInquiryId = new Map(inquiries.map((i) => [i.id, i.hospital.name]));

  const items = [
    ...events.map((e) => ({
      type: "CASE_STATUS_EVENT",
      subtype: e.type,
      occurredAt: e.createdAt,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      hospitalName: e.inquiryId ? (hospitalNameByInquiryId.get(e.inquiryId) ?? null) : null,
      actor: e.actor,
    })),
    ...notes.map((n) => ({
      type: "NOTE",
      occurredAt: n.createdAt,
      body: n.body,
      actor: n.author,
    })),
    ...payments.map((p) => ({
      type: "PAYMENT_RECEIVED",
      occurredAt: p.paidAt,
      amount: p.amount,
      currency: p.currency,
      travelerType: p.visaApplication.travelerType,
      actor: p.receivedBy,
    })),
    ...expenses.map((e) => ({
      type: "EXPENSE_PAID",
      occurredAt: e.incurredAt,
      amount: e.amount,
      currency: e.currency,
      category: e.category,
      actor: e.paidBy,
    })),
    ...refunds.map((r) => ({
      type: "REFUND_ISSUED",
      occurredAt: r.refundedAt,
      amount: r.amount,
      reason: r.reason,
      travelerType: r.payment.visaApplication.travelerType,
      actor: r.refundedBy,
    })),
    ...documents.map((d) => ({
      type: "DOCUMENT_UPLOADED",
      occurredAt: d.createdAt,
      fileName: d.fileName,
      actor: d.uploadedBy,
    })),
  ];

  items.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  return items;
};
