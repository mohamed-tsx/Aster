import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import {
  sendInquiry,
  respondToInquiry,
  recordFeePaymentByTraveler,
  markEmbassyVisited,
  createCase,
} from "../../Src/Services/Cases/casesService.js";
import {
  createUser,
  createHospital,
  createPatient,
  createAccount,
  caseIntakeFiles,
} from "../helpers/factories.js";
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

describe("agency case: by-traveler fee payment", () => {
  const agencyIntake = async (user, withAttendant = false) => {
    const agency = await Prisma.agency.create({ data: { name: `Ag ${Date.now()}${Math.random()}` } });
    return createCase(
      {
        firstName: "P", lastName: "Q", gender: "MALE", dateOfBirth: "1990-01-01",
        nationality: "X", phone: "1", reachOutType: "AGENCY", agencyId: agency.id,
        hasAttendant: withAttendant,
        ...(withAttendant
          ? {
              attendantFirstName: "A", attendantLastName: "B", attendantGender: "MALE",
              attendantDateOfBirth: "1980-01-01", attendantNationality: "X",
              attendantPassportNumber: "A1", attendantPassportExpiry: "2031-01-01",
              attendantPhone: "9", attendantRelationToPatient: "Bro",
            }
          : {}),
      },
      caseIntakeFiles(),
      user.id,
    );
  };

  it("lazily creates the patient visa app and records the payment", async () => {
    const user = await createUser();
    const account = await createAccount();
    const hospital = await createHospital();
    const kase = await agencyIntake(user);
    const inquiry = await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);
    await respondToInquiry(kase.id, inquiry.id, { status: "ACCEPTED" }, user.id);

    const visaApp = await recordFeePaymentByTraveler(
      kase.id, { travelerType: "PATIENT", accountId: account.id, amount: 100 }, user.id,
    );
    expect(visaApp.status).toBe("FEE_PAID");

    const payments = await Prisma.payment.findMany({ where: { visaApplication: { caseId: kase.id } } });
    expect(payments).toHaveLength(1);
    const txns = await Prisma.accountTransaction.findMany({ where: { accountId: account.id } });
    expect(txns).toHaveLength(1);
  });

  it("skips the attendant-passport gate for agency cases", async () => {
    const user = await createUser();
    const account = await createAccount();
    const hospital = await createHospital();
    const kase = await agencyIntake(user, true);
    const inquiry = await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);
    await respondToInquiry(kase.id, inquiry.id, { status: "ACCEPTED" }, user.id);

    const visaApp = await recordFeePaymentByTraveler(
      kase.id, { travelerType: "PATIENT", accountId: account.id, amount: 100 }, user.id,
    );
    expect(visaApp.status).toBe("FEE_PAID"); // no throw despite no attendant passport
  });

  it("rejects a by-traveler payment on a DIRECT case with no visa app", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase(
      { firstName: "D", lastName: "C", gender: "MALE", dateOfBirth: "1990-01-01",
        nationality: "X", phone: "1", reachOutType: "DIRECT", hasAttendant: false },
      caseIntakeFiles(), user.id,
    );
    await expect(
      recordFeePaymentByTraveler(kase.id, { travelerType: "PATIENT", accountId: account.id, amount: 100 }, user.id),
    ).rejects.toThrow("No visa application exists for this traveler yet");
  });

  it("rejects an invalid travelerType", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await agencyIntake(user);
    await expect(
      recordFeePaymentByTraveler(kase.id, { travelerType: "SIBLING", accountId: account.id, amount: 100 }, user.id),
    ).rejects.toThrow("travelerType must be PATIENT or ATTENDANT");
  });

  it("rejects an ATTENDANT payment when the case has no attendant", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await agencyIntake(user, false);
    await expect(
      recordFeePaymentByTraveler(kase.id, { travelerType: "ATTENDANT", accountId: account.id, amount: 100 }, user.id),
    ).rejects.toThrow("This case has no attendant");
  });

  it("lazily creates the ATTENDANT visa app for an agency case with an attendant", async () => {
    const user = await createUser();
    const account = await createAccount();
    const hospital = await createHospital();
    const kase = await agencyIntake(user, true);
    const inquiry = await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);
    await respondToInquiry(kase.id, inquiry.id, { status: "ACCEPTED" }, user.id);

    const visaApp = await recordFeePaymentByTraveler(
      kase.id, { travelerType: "ATTENDANT", accountId: account.id, amount: 100 }, user.id,
    );
    expect(visaApp.travelerType).toBe("ATTENDANT");
    expect(visaApp.status).toBe("FEE_PAID");
  });

  it("rejects a by-traveler payment before a hospital has accepted the case, with no stray visa app", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await agencyIntake(user); // status still NEW — no inquiry accepted

    await expect(
      recordFeePaymentByTraveler(
        kase.id, { travelerType: "PATIENT", accountId: account.id, amount: 100 }, user.id,
      ),
    ).rejects.toThrow(/after a hospital has accepted/);

    const count = await Prisma.visaApplication.count({ where: { caseId: kase.id } });
    expect(count).toBe(0);
  });

  it("does not persist a stray PENDING visa app when the payment fails money validation", async () => {
    const user = await createUser();
    const hospital = await createHospital();
    const kase = await agencyIntake(user);
    const inquiry = await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);
    await respondToInquiry(kase.id, inquiry.id, { status: "ACCEPTED" }, user.id);

    await expect(
      recordFeePaymentByTraveler(
        kase.id, { travelerType: "PATIENT", accountId: "does-not-exist", amount: 100 }, user.id,
      ),
    ).rejects.toThrow();

    const count = await Prisma.visaApplication.count({ where: { caseId: kase.id } });
    expect(count).toBe(0);
  });
});

describe("agency case: visa step ordering", () => {
  it("rejects markEmbassyVisited while the PATIENT visa app is still PENDING (fee unpaid)", async () => {
    const user = await createUser();
    const hospital = await createHospital();
    const kase = await agencyCase();
    const inquiry = await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);
    await respondToInquiry(kase.id, inquiry.id, { status: "ACCEPTED" }, user.id);

    const visaApp = await Prisma.visaApplication.create({
      data: { caseId: kase.id, travelerType: "PATIENT" },
    });

    await expect(
      markEmbassyVisited(kase.id, visaApp.id, { embassyVisitDate: "2026-01-01" }, user.id),
    ).rejects.toThrow(/fee must be paid/);
  });
});
