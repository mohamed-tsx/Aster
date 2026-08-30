import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import {
  createCase,
  sendInquiry,
  respondToInquiry,
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
} from "../helpers/factories.js";

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

  it("logs INQUIRY_STATUS_CHANGED and CASE_STATUS_CHANGED when an inquiry is accepted", async () => {
    const user = await createUser();
    const patient = await createPatient();
    const hospital = await createHospital();
    const kase = await createCase({ patientId: patient.id, reachOutType: "DIRECT" }, caseIntakeFiles(), user.id);
    const inquiry = await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);

    await respondToInquiry(kase.id, inquiry.id, { status: "ACCEPTED" }, user.id);

    const events = await eventsFor(kase.id);
    const inquiryEvent = events.find((e) => e.type === "INQUIRY_STATUS_CHANGED");
    expect(inquiryEvent.fromStatus).toBe("PENDING");
    expect(inquiryEvent.toStatus).toBe("ACCEPTED");
    expect(inquiryEvent.inquiryId).toBe(inquiry.id);

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
    const hospital = await createHospital();
    const kase = await createCase({ patientId: patient.id, reachOutType: "DIRECT" }, caseIntakeFiles(), user.id);
    const inquiry = await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);
    await respondToInquiry(kase.id, inquiry.id, { status: "ACCEPTED" }, user.id);
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
    const hospital = await createHospital();
    const kase = await createCase({ patientId: patient.id, reachOutType: "DIRECT" }, caseIntakeFiles(), user.id);
    const inquiry = await sendInquiry(kase.id, { hospitalId: hospital.id }, user.id);
    await respondToInquiry(kase.id, inquiry.id, { status: "ACCEPTED" }, user.id);
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
});
