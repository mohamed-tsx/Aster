import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import {
  sendInquiry,
  respondToInquiry,
} from "../../Src/Services/Cases/casesService.js";
import { createUser, createHospital, createPatient } from "../helpers/factories.js";
import { createCase as createCaseRow } from "../helpers/factories.js";

// Helper: an agency-sourced case row with an agency attached.
const agencyCase = async (overrides = {}) => {
  const agency = await Prisma.agency.create({ data: { name: `Ag ${Date.now()}${Math.random()}` } });
  return createCaseRow({ reachOutType: "AGENCY", agencyId: agency.id, ...overrides });
};

describe("agency case: hospital acceptance does not auto-create visa applications", () => {
  it("creates no VisaApplication rows when an agency case's inquiry is accepted", async () => {
    const user = await createUser();
    const hospital = await createHospital();
    const kase = await agencyCase();

    const inquiry = await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);
    await respondToInquiry(kase.id, inquiry.id, { status: "ACCEPTED" }, user.id);

    const visaApps = await Prisma.visaApplication.findMany({ where: { caseId: kase.id } });
    expect(visaApps).toHaveLength(0);

    const updated = await Prisma.case.findUnique({ where: { id: kase.id } });
    expect(updated.status).toBe("HOSPITAL_ACCEPTED");
  });

  it("creates no VisaApplication rows for an agency case that has an attendant", async () => {
    const user = await createUser();
    const hospital = await createHospital();
    const kase = await agencyCase();
    await Prisma.attendant.create({
      data: {
        caseId: kase.id,
        firstName: "Amina",
        lastName: "Doe",
        gender: "FEMALE",
        dateOfBirth: new Date("1985-01-01"),
        nationality: "Testland",
        phone: "1234567890",
        relationToPatient: "Spouse",
      },
    });

    const inquiry = await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);
    await respondToInquiry(kase.id, inquiry.id, { status: "ACCEPTED" }, user.id);

    const visaApps = await Prisma.visaApplication.findMany({ where: { caseId: kase.id } });
    expect(visaApps).toHaveLength(0);
  });

  it("still auto-creates visa apps for a DIRECT case (regression)", async () => {
    const user = await createUser();
    const hospital = await createHospital();
    const patient = await createPatient();
    const kase = await createCaseRow({ patientId: patient.id, reachOutType: "DIRECT" });

    const inquiry = await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);
    await respondToInquiry(kase.id, inquiry.id, { status: "ACCEPTED" }, user.id);

    const visaApps = await Prisma.visaApplication.findMany({ where: { caseId: kase.id } });
    expect(visaApps).toHaveLength(1);
    expect(visaApps[0].travelerType).toBe("PATIENT");
  });
});
