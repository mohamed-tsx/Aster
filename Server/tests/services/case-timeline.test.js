import { describe, it, expect } from "vitest";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { getCaseTimeline, createCase } from "../../Src/Services/Cases/casesService.js";
import { createCaseNote } from "../../Src/Services/CaseNotes/caseNotesService.js";
import { createExpense } from "../../Src/Services/Expenses/expensesService.js";
import {
  createUser,
  createAccount,
  createPatient,
  createVisaApplication,
  createPayment,
  caseIntakeFiles,
} from "../helpers/factories.js";

describe("getCaseTimeline", () => {
  it("merges status events, notes, payments, and expenses in chronological order", async () => {
    const user = await createUser();
    const account = await createAccount();
    const patient = await createPatient();
    // Goes through the real service (not the raw-Prisma factory) so it logs
    // a CASE_CREATED event, exercising the timeline's CaseEvent merge too.
    const kase = await createCase({ patientId: patient.id, reachOutType: "DIRECT" }, caseIntakeFiles(), user.id);
    const visaApplication = await createVisaApplication({ caseId: kase.id });
    await createPayment({
      visaApplicationId: visaApplication.id,
      receivedById: user.id,
      accountId: account.id,
    });
    await createExpense(
      { caseId: kase.id, category: "Travel", amount: 20, currency: "USD", accountId: account.id },
      user.id,
    );
    await createCaseNote(kase.id, { body: "Called patient" }, user.id);

    const timeline = await getCaseTimeline(kase.id);

    const types = timeline.map((item) => item.type);
    expect(types).toContain("CASE_STATUS_EVENT");
    expect(types).toContain("NOTE");
    expect(types).toContain("PAYMENT_RECEIVED");
    expect(types).toContain("EXPENSE_PAID");

    // Oldest first.
    for (let i = 1; i < timeline.length; i++) {
      expect(new Date(timeline[i].occurredAt).getTime()).toBeGreaterThanOrEqual(
        new Date(timeline[i - 1].occurredAt).getTime(),
      );
    }
  });

  it("rejects an unknown case", async () => {
    await expect(getCaseTimeline("does-not-exist")).rejects.toThrow(AppError);
  });
});
