import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import {
  createCase,
  getCaseById,
  sendInquiry,
  cancelCase,
  recordFeePayment,
  markEmbassyVisited,
  recordVisaOutcome,
} from "../../Src/Services/Cases/casesService.js";
import {
  createUser,
  createAccount,
  createPatient,
  createHospital,
  caseIntakeFiles,
  recordChosenResponseFor,
} from "../helpers/factories.js";
import { createCase as createCaseRow } from "../helpers/factories.js";

const eventsFor = (caseId) =>
  Prisma.caseEvent.findMany({ where: { caseId }, orderBy: { createdAt: "asc" } });

describe("case status-change event logging", () => {
  it("logs a CASE_CREATED event on creation, attributed to the creating user", async () => {
    const user = await createUser();
    const patient = await createPatient();

    const kase = await createCase(
      { patientId: patient.id, reachOutType: "DIRECT" },
      caseIntakeFiles(),
      user.id,
    );

    const events = await eventsFor(kase.id);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("CASE_CREATED");
    expect(events[0].toStatus).toBe("NEW");
    expect(events[0].actorId).toBe(user.id);
  });

  it("logs a CASE_STATUS_CHANGED event when an inquiry is sent", async () => {
    const user = await createUser();
    const patient = await createPatient();
    const hospital = await createHospital();
    const kase = await createCase({ patientId: patient.id, reachOutType: "DIRECT" }, caseIntakeFiles(), user.id);

    await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);

    const events = await eventsFor(kase.id);
    const transition = events.find((e) => e.type === "CASE_STATUS_CHANGED");
    expect(transition.fromStatus).toBe("NEW");
    expect(transition.toStatus).toBe("HOSPITAL_MATCHING");
    expect(transition.actorId).toBe(user.id);
  });

  it("logs HOSPITAL_CHOSEN and CASE_STATUS_CHANGED when a hospital is chosen", async () => {
    const user = await createUser();
    const patient = await createPatient();
    const kase = await createCase({ patientId: patient.id, reachOutType: "DIRECT" }, caseIntakeFiles(), user.id);

    await recordChosenResponseFor(kase.id, { user });
    const chosen = await Prisma.hospitalInquiry.findFirst({ where: { caseId: kase.id, isChosen: true } });

    const events = await eventsFor(kase.id);
    const chosenEvent = events.find((e) => e.type === "HOSPITAL_CHOSEN");
    expect(chosenEvent.toStatus).toBe("ACCEPTED");
    expect(chosenEvent.inquiryId).toBe(chosen.id);

    const caseEvent = events.find(
      (e) => e.type === "CASE_STATUS_CHANGED" && e.toStatus === "HOSPITAL_ACCEPTED",
    );
    expect(caseEvent.fromStatus).toBe("HOSPITAL_MATCHING");
  });

  it("logs a CASE_STATUS_CHANGED event on cancellation", async () => {
    const user = await createUser();
    const patient = await createPatient();
    const kase = await createCase({ patientId: patient.id, reachOutType: "DIRECT" }, caseIntakeFiles(), user.id);

    await cancelCase(kase.id, user.id);

    const events = await eventsFor(kase.id);
    const transition = events.find((e) => e.type === "CASE_STATUS_CHANGED");
    expect(transition.fromStatus).toBe("NEW");
    expect(transition.toStatus).toBe("CANCELLED");
    expect(transition.actorId).toBe(user.id);
  });

  it("logs VISA_STATUS_CHANGED and the case's VISA_PROCESSING transition on first fee payment", async () => {
    const user = await createUser();
    const account = await createAccount();
    const patient = await createPatient();
    const kase = await createCase({ patientId: patient.id, reachOutType: "DIRECT" }, caseIntakeFiles(), user.id);
    await recordChosenResponseFor(kase.id, { user });
    const visaApplication = await Prisma.visaApplication.findFirstOrThrow({ where: { caseId: kase.id } });

    await recordFeePayment(kase.id, visaApplication.id, { accountId: account.id, amount: 100 }, user.id);

    const events = await eventsFor(kase.id);
    const visaEvent = events.find((e) => e.type === "VISA_STATUS_CHANGED");
    expect(visaEvent.fromStatus).toBe("PENDING");
    expect(visaEvent.toStatus).toBe("FEE_PAID");
    expect(visaEvent.visaApplicationId).toBe(visaApplication.id);

    const caseEvent = events.find(
      (e) => e.type === "CASE_STATUS_CHANGED" && e.toStatus === "VISA_PROCESSING",
    );
    expect(caseEvent).toBeTruthy();
  });

  it("logs VISA_STATUS_CHANGED on embassy visit and visa outcome, actorId included", async () => {
    const user = await createUser();
    const account = await createAccount();
    const patient = await createPatient();
    const kase = await createCase({ patientId: patient.id, reachOutType: "DIRECT" }, caseIntakeFiles(), user.id);
    await recordChosenResponseFor(kase.id, { user });
    const visaApplication = await Prisma.visaApplication.findFirstOrThrow({ where: { caseId: kase.id } });
    await recordFeePayment(kase.id, visaApplication.id, { accountId: account.id, amount: 100 }, user.id);

    await markEmbassyVisited(kase.id, visaApplication.id, { embassyVisitDate: "2026-01-01" }, user.id);
    await recordVisaOutcome(
      kase.id,
      visaApplication.id,
      { status: "APPROVED", visaNumber: "V-1" },
      user.id,
    );

    const events = await eventsFor(kase.id);
    const embassyEvent = events.find((e) => e.toStatus === "EMBASSY_VISITED");
    expect(embassyEvent.fromStatus).toBe("FEE_PAID");
    expect(embassyEvent.actorId).toBe(user.id);

    const outcomeEvent = events.find((e) => e.toStatus === "APPROVED");
    expect(outcomeEvent.fromStatus).toBe("EMBASSY_VISITED");

    // Single visa application, so it's also the case's only one -> case completes too.
    const caseCompleted = events.find(
      (e) => e.type === "CASE_STATUS_CHANGED" && e.toStatus === "COMPLETED",
    );
    expect(caseCompleted).toBeTruthy();
  });

  it("allows several pending inquiries on one case, but not two to the same hospital", async () => {
    const user = await createUser();
    const kase = await createCaseRow();
    const h1 = await createHospital();
    const h2 = await createHospital();

    await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    await sendInquiry(kase.id, { hospitalId: h2.id }, user.id); // no throw

    const open = await Prisma.hospitalInquiry.findMany({ where: { caseId: kase.id, status: "PENDING" } });
    expect(open).toHaveLength(2);

    const dupe = sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    await expect(dupe).rejects.toThrow(/already has a pending inquiry to this hospital/);
    await expect(dupe).rejects.toMatchObject({ statusCode: 409, errorCode: "CONFLICT" });
  });

  it("logs no new CASE_STATUS_CHANGED event for a 2nd concurrent inquiry to another hospital", async () => {
    const user = await createUser();
    const kase = await createCaseRow();
    const h1 = await createHospital();
    const h2 = await createHospital();

    await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    const afterFirst = (await eventsFor(kase.id)).filter((e) => e.type === "CASE_STATUS_CHANGED");
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0].fromStatus).toBe("NEW");
    expect(afterFirst[0].toStatus).toBe("HOSPITAL_MATCHING");

    await sendInquiry(kase.id, { hospitalId: h2.id }, user.id);
    const afterSecond = (await eventsFor(kase.id)).filter((e) => e.type === "CASE_STATUS_CHANGED");
    expect(afterSecond).toHaveLength(1);
  });

  it("returns each inquiry with a documents array in the case detail", async () => {
    const user = await createUser();
    const kase = await createCaseRow();
    const hospital = await createHospital();
    await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);

    const detail = await getCaseById(kase.id);
    expect(detail.inquiries).toHaveLength(1);
    expect(Array.isArray(detail.inquiries[0].documents)).toBe(true);
    expect(detail.inquiries[0]).toHaveProperty("hospital");
  });
});
