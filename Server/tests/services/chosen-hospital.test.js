import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { sendInquiry, recordChosenResponse, respondToInquiry } from "../../Src/Services/Cases/casesService.js";
import { changeChosenHospital, recordFeePaymentByTraveler } from "../../Src/Services/Cases/casesService.js";
import { createUser, createHospital, createCase, chosenResponseFiles } from "../helpers/factories.js";
import { createAccount } from "../helpers/factories.js";
import { createCase as createCaseRow } from "../helpers/factories.js";

const agencyCase = async () => {
  const agency = await Prisma.agency.create({ data: { name: `Ag ${Date.now()}${Math.random()}` } });
  return createCaseRow({ reachOutType: "AGENCY", agencyId: agency.id });
};

describe("recordChosenResponse", () => {
  it("chooses one inquiry, marks the rest NOT_SELECTED, advances the case, creates visa apps", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital({ country: "India" });
    const h2 = await createHospital({ country: "UAE" });
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    await sendInquiry(kase.id, { hospitalId: h2.id }, user.id);

    const updated = await recordChosenResponse(
      kase.id, i1.id,
      { treatmentCostEstimate: 8000, currency: "USD" },
      chosenResponseFiles(),
      user.id,
    );

    expect(updated.status).toBe("HOSPITAL_ACCEPTED");
    const inquiries = await Prisma.hospitalInquiry.findMany({ where: { caseId: kase.id } });
    expect(inquiries.find((i) => i.id === i1.id)).toMatchObject({ status: "ACCEPTED", isChosen: true });
    expect(inquiries.filter((i) => i.status === "NOT_SELECTED")).toHaveLength(1);

    const docs = await Prisma.document.findMany({ where: { hospitalInquiryId: i1.id }, orderBy: { type: "asc" } });
    expect(docs.map((d) => d.type).sort()).toEqual(["EVALUATION_DOC", "INVITATION_LETTER"]);

    const visaApps = await Prisma.visaApplication.findMany({ where: { caseId: kase.id } });
    expect(visaApps).toHaveLength(1);
    expect(visaApps[0].travelerType).toBe("PATIENT");
  });

  it("creates no visa apps for an agency case", async () => {
    const user = await createUser();
    const kase = await agencyCase();
    const h = await createHospital();
    const i = await sendInquiry(kase.id, { hospitalId: h.id }, user.id);
    await recordChosenResponse(kase.id, i.id, { treatmentCostEstimate: 1, currency: "USD" }, chosenResponseFiles(), user.id);
    const visaApps = await Prisma.visaApplication.findMany({ where: { caseId: kase.id } });
    expect(visaApps).toHaveLength(0);
  });

  it("rejects a second chosen response on the same case", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital();
    const h2 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    const i2 = await sendInquiry(kase.id, { hospitalId: h2.id }, user.id);
    await recordChosenResponse(kase.id, i1.id, { treatmentCostEstimate: 1, currency: "USD" }, chosenResponseFiles(), user.id);
    await expect(
      recordChosenResponse(kase.id, i2.id, { treatmentCostEstimate: 1, currency: "USD" }, chosenResponseFiles(), user.id),
    ).rejects.toThrow(/already has a chosen hospital/);
  });

  it("requires both documents", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h = await createHospital();
    const i = await sendInquiry(kase.id, { hospitalId: h.id }, user.id);
    const files = chosenResponseFiles();
    delete files.invitationLetter;
    await expect(
      recordChosenResponse(kase.id, i.id, { treatmentCostEstimate: 1, currency: "USD" }, files, user.id),
    ).rejects.toThrow(/invitation letter is required/i);
  });

  it("rejects a bad currency and a missing cost", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h = await createHospital();
    const i = await sendInquiry(kase.id, { hospitalId: h.id }, user.id);
    await expect(
      recordChosenResponse(kase.id, i.id, { treatmentCostEstimate: 1, currency: "GBP" }, chosenResponseFiles(), user.id),
    ).rejects.toThrow(AppError);
    await expect(
      recordChosenResponse(kase.id, i.id, { currency: "USD" }, chosenResponseFiles(), user.id),
    ).rejects.toThrow(/treatment cost/i);
  });
});

describe("respondToInquiry — decline only", () => {
  it("declines an inquiry without advancing the case while others are open", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital();
    const h2 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    await sendInquiry(kase.id, { hospitalId: h2.id }, user.id);

    await respondToInquiry(kase.id, i1.id, { notes: "too expensive" }, user.id);

    const c = await Prisma.case.findUnique({ where: { id: kase.id } });
    expect(c.status).toBe("HOSPITAL_MATCHING");
    const declined = await Prisma.hospitalInquiry.findUnique({ where: { id: i1.id } });
    expect(declined.status).toBe("DECLINED");
  });

  it("moves the case to HOSPITAL_DECLINED when the last open inquiry is declined", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    await respondToInquiry(kase.id, i1.id, {}, user.id);
    const c = await Prisma.case.findUnique({ where: { id: kase.id } });
    expect(c.status).toBe("HOSPITAL_DECLINED");
  });

  it("rejects an ACCEPTED status", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    await expect(
      respondToInquiry(kase.id, i1.id, { status: "ACCEPTED" }, user.id),
    ).rejects.toThrow(/use the record-response action/i);
  });
});

describe("changeChosenHospital", () => {
  it("re-points the chosen hospital, keeps visa apps, NOT_SELECTs the old one", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital();
    const h2 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    const i2 = await sendInquiry(kase.id, { hospitalId: h2.id }, user.id);
    await recordChosenResponse(kase.id, i1.id, { treatmentCostEstimate: 1, currency: "USD" }, chosenResponseFiles(), user.id);
    const visaBefore = await Prisma.visaApplication.findMany({ where: { caseId: kase.id } });

    await changeChosenHospital(kase.id, i2.id, { treatmentCostEstimate: 2, currency: "USD" }, chosenResponseFiles(), user.id);

    const inqs = await Prisma.hospitalInquiry.findMany({ where: { caseId: kase.id } });
    expect(inqs.find((i) => i.id === i1.id)).toMatchObject({ isChosen: false, status: "NOT_SELECTED" });
    expect(inqs.find((i) => i.id === i2.id)).toMatchObject({ isChosen: true, status: "ACCEPTED" });
    const visaAfter = await Prisma.visaApplication.findMany({ where: { caseId: kase.id } });
    expect(visaAfter.map((v) => v.id).sort()).toEqual(visaBefore.map((v) => v.id).sort());
  });

  it("is rejected once a visa fee has been paid", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase();
    const h1 = await createHospital();
    const h2 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    const i2 = await sendInquiry(kase.id, { hospitalId: h2.id }, user.id);
    await recordChosenResponse(kase.id, i1.id, { treatmentCostEstimate: 1, currency: "USD" }, chosenResponseFiles(), user.id);
    await recordFeePaymentByTraveler(kase.id, { travelerType: "PATIENT", accountId: account.id, amount: 100 }, user.id);

    await expect(
      changeChosenHospital(kase.id, i2.id, { treatmentCostEstimate: 2, currency: "USD" }, chosenResponseFiles(), user.id),
    ).rejects.toThrow(/cannot be changed after a visa fee has been paid/i);
  });
});
