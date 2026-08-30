import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import {
  createCase,
  sendInquiry,
  respondToInquiry,
  recordFeePayment,
} from "../../Src/Services/Cases/casesService.js";
import {
  createUser,
  createAccount,
  createHospital,
  caseIntakeFiles,
  attachDocument,
} from "../helpers/factories.js";

const withAttendant = (overrides = {}) => ({
  firstName: "Jane", lastName: "Doe", gender: "FEMALE", dateOfBirth: "1990-01-01",
  nationality: "Testland", phone: "1", reachOutType: "DIRECT",
  hasAttendant: true,
  attendantFirstName: "Al", attendantLastName: "Kin", attendantGender: "MALE",
  attendantDateOfBirth: "1980-01-01", attendantNationality: "Testland",
  attendantPassportNumber: "A1", attendantPassportExpiry: "2031-01-01",
  attendantPhone: "9", attendantRelationToPatient: "Brother",
  ...overrides,
});

const acceptAndGetPatientVisaApp = async (kaseId, user) => {
  const hospital = await createHospital();
  const inquiry = await sendInquiry(kaseId, { hospitalId: hospital.id }, user.id);
  await respondToInquiry(kaseId, inquiry.id, { status: "ACCEPTED" }, user.id);
  return Prisma.visaApplication.findFirstOrThrow({ where: { caseId: kaseId, travelerType: "PATIENT" } });
};

describe("attendant-passport gate on first fee payment (direct cases)", () => {
  it("blocks the fee payment when the attendant passport is missing", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase(withAttendant(), caseIntakeFiles(), user.id);
    const visaApp = await acceptAndGetPatientVisaApp(kase.id, user);

    await expect(
      recordFeePayment(kase.id, visaApp.id, { accountId: account.id, amount: 100 }, user.id),
    ).rejects.toThrow("Attendant passport must be uploaded before visa processing");
  });

  it("allows it once the attendant passport is uploaded", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase(withAttendant(), caseIntakeFiles(), user.id);
    const visaApp = await acceptAndGetPatientVisaApp(kase.id, user);
    await attachDocument({ caseId: kase.id, type: "ATTENDANT_PASSPORT", uploadedById: user.id });

    const updated = await recordFeePayment(
      kase.id, visaApp.id, { accountId: account.id, amount: 100 }, user.id,
    );
    expect(updated.status).toBe("FEE_PAID");
  });

  it("does not gate a case with no attendant", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase(
      { ...withAttendant({ hasAttendant: false }) }, caseIntakeFiles(), user.id,
    );
    const visaApp = await acceptAndGetPatientVisaApp(kase.id, user);
    const updated = await recordFeePayment(
      kase.id, visaApp.id, { accountId: account.id, amount: 100 }, user.id,
    );
    expect(updated.status).toBe("FEE_PAID");
  });
});
