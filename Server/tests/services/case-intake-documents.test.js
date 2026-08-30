import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { createCase, searchPatients } from "../../Src/Services/Cases/casesService.js";
import {
  createUser,
  createPatient,
  caseIntakeFiles,
  fakeUpload,
  attachDocument,
} from "../helpers/factories.js";
import { createCase as createCaseRow } from "../helpers/factories.js";

const baseData = (overrides = {}) => ({
  firstName: "Jane", lastName: "Doe", gender: "FEMALE",
  dateOfBirth: "1990-01-01", nationality: "Testland",
  phone: "123456789", reachOutType: "DIRECT", hasAttendant: false,
  ...overrides,
});

describe("createCase — required documents", () => {
  it("rejects when the patient passport file is missing", async () => {
    const user = await createUser();
    const files = caseIntakeFiles();
    delete files.patientPassport;
    const err = await createCase(baseData(), files, user.id).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("Patient passport is required");
    expect(err.statusCode).toBe(400);
    expect(err.errorCode).toBe("VALIDATION_ERROR");
  });

  it("rejects when the case document file is missing", async () => {
    const user = await createUser();
    const files = caseIntakeFiles();
    delete files.caseDocument;
    await expect(createCase(baseData(), files, user.id)).rejects.toThrow(
      "Case document is required",
    );
  });

  it("creates the case and both Document rows when files are supplied", async () => {
    const user = await createUser();
    const kase = await createCase(baseData(), caseIntakeFiles(), user.id);

    const docs = await Prisma.document.findMany({ where: { caseId: kase.id }, orderBy: { type: "asc" } });
    const types = docs.map((d) => d.type).sort();
    expect(types).toEqual(["CASE_DOCUMENT", "PATIENT_PASSPORT"]);
    for (const d of docs) {
      expect(d.fileUrl).toContain(`/uploads/documents/${kase.id}/`);
      expect(d.uploadedById).toBe(user.id);
    }
  });

  it("attaches the attendant passport when provided", async () => {
    const user = await createUser();
    const files = { ...caseIntakeFiles(), attendantPassport: [fakeUpload("att.jpg", "image/jpeg")] };
    const kase = await createCase(
      baseData({
        hasAttendant: true,
        attendantFirstName: "Al", attendantLastName: "Kin", attendantGender: "MALE",
        attendantDateOfBirth: "1980-01-01", attendantNationality: "Testland",
        attendantPassportNumber: "A1", attendantPassportExpiry: "2031-01-01",
        attendantPhone: "999", attendantRelationToPatient: "Brother",
      }),
      files,
      user.id,
    );
    const attDoc = await Prisma.document.findFirst({ where: { caseId: kase.id, type: "ATTENDANT_PASSPORT" } });
    expect(attDoc).not.toBeNull();
  });

  it("still succeeds with an attendant but no attendant passport", async () => {
    const user = await createUser();
    const kase = await createCase(
      baseData({
        hasAttendant: true,
        attendantFirstName: "Al", attendantLastName: "Kin", attendantGender: "MALE",
        attendantDateOfBirth: "1980-01-01", attendantNationality: "Testland",
        attendantPassportNumber: "A1", attendantPassportExpiry: "2031-01-01",
        attendantPhone: "999", attendantRelationToPatient: "Brother",
      }),
      caseIntakeFiles(),
      user.id,
    );
    expect(kase.attendant).not.toBeNull();
    const attDoc = await Prisma.document.findFirst({ where: { caseId: kase.id, type: "ATTENDANT_PASSPORT" } });
    expect(attDoc).toBeNull();
  });

  it("coerces the string \"false\" hasAttendant so no attendant is created", async () => {
    const user = await createUser();
    const kase = await createCase(
      baseData({ hasAttendant: "false" }),
      caseIntakeFiles(),
      user.id,
    );
    expect(kase.attendant).toBeNull();
  });

  it("reuse exception: existing patient with a prior PATIENT_PASSPORT needs no new file", async () => {
    const user = await createUser();
    const patient = await createPatient();
    const priorCase = await createCaseRow({ patientId: patient.id });
    await attachDocument({ caseId: priorCase.id, type: "PATIENT_PASSPORT", uploadedById: user.id });

    const files = caseIntakeFiles();
    delete files.patientPassport;
    const kase = await createCase(
      { reachOutType: "DIRECT", hasAttendant: false, patientId: patient.id },
      files,
      user.id,
    );
    expect(kase.patientId).toBe(patient.id);
  });

  it("reuse without a prior passport is still rejected", async () => {
    const user = await createUser();
    const patient = await createPatient();
    await createCaseRow({ patientId: patient.id });

    const files = caseIntakeFiles();
    delete files.patientPassport;
    await expect(
      createCase({ reachOutType: "DIRECT", hasAttendant: false, patientId: patient.id }, files, user.id),
    ).rejects.toThrow("Patient passport is required");
  });

  it("rolls back the case if a document write fails", async () => {
    const user = await createUser();
    const badFiles = { ...caseIntakeFiles(), caseDocument: [fakeUpload("x.exe", "application/x-msdownload")] };
    // The patient passport (docPlan[0]) writes fine, then the bad caseDocument
    // (docPlan[1]) makes saveDocumentLocal throw -> the whole tx rolls back,
    // including the already-written PATIENT_PASSPORT document row.
    await expect(createCase(baseData(), badFiles, user.id)).rejects.toThrow(
      /Unsupported document mime type/,
    );
    expect(await Prisma.case.count()).toBe(0);
    expect(await Prisma.document.count()).toBe(0);
  });
});

describe("searchPatients — hasPassportOnFile", () => {
  it("flags a patient who has a PATIENT_PASSPORT on some case", async () => {
    const user = await createUser();
    const patient = await createPatient({ passportNumber: "SEARCHME123" });
    const kase = await createCaseRow({ patientId: patient.id });
    await attachDocument({ caseId: kase.id, type: "PATIENT_PASSPORT", uploadedById: user.id });

    const [row] = await searchPatients("SEARCHME123");
    expect(row.hasPassportOnFile).toBe(true);
  });

  it("is false for a patient with no passport document", async () => {
    const patient = await createPatient({ passportNumber: "NOPASSPORT9" });
    await createCaseRow({ patientId: patient.id });
    const [row] = await searchPatients("NOPASSPORT9");
    expect(row.hasPassportOnFile).toBe(false);
  });
});
