import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import {
  getCaseStats,
  getFinanceStats,
  getRecentActivity,
} from "../../Src/Services/Dashboard/dashboardService.js";
import { createExpense } from "../../Src/Services/Expenses/expensesService.js";
import {
  createUser,
  createAccount,
  createCase,
  createVisaApplication,
  createPayment,
  createLoan,
  createPayable,
} from "../helpers/factories.js";

describe("getCaseStats", () => {
  it("counts cases by status and pending workflow items", async () => {
    await createCase({ status: "NEW" });
    await createCase({ status: "NEW" });
    await createCase({ status: "VISA_PROCESSING" });

    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase({ status: "VISA_PROCESSING" });
    const pendingFeeVisa = await createVisaApplication({ caseId: kase.id, travelerType: "PATIENT" });
    const feePaidVisa = await createVisaApplication({ caseId: kase.id, travelerType: "ATTENDANT" });
    await createPayment({
      visaApplicationId: feePaidVisa.id,
      receivedById: user.id,
      accountId: account.id,
    });
    await Prisma.visaApplication.update({ where: { id: feePaidVisa.id }, data: { status: "FEE_PAID" } });

    const stats = await getCaseStats();

    expect(stats.statusCounts.NEW).toBe(2);
    expect(stats.statusCounts.VISA_PROCESSING).toBe(2);
    expect(stats.visasAwaitingFee).toBe(1);
    expect(stats.visasAwaitingEmbassyVisit).toBe(1);
    void pendingFeeVisa;
  });
});

describe("getFinanceStats", () => {
  it("sums balances across active accounts by currency", async () => {
    const user = await createUser();
    const accountA = await createAccount();
    const accountB = await createAccount();
    const kase = await createCase();
    const visaApplication = await createVisaApplication({ caseId: kase.id });

    await createPayment({
      visaApplicationId: visaApplication.id,
      receivedById: user.id,
      accountId: accountA.id,
      amount: 100,
    });
    await createExpense(
      { category: "Fuel", amount: 15, currency: "USD", accountId: accountB.id },
      user.id,
    );

    const stats = await getFinanceStats();

    expect(stats.totalBalances.USD).toBe(85);
  });
});

describe("getFinanceStats — obligations", () => {
  it("sums outstanding loans and payables by currency", async () => {
    const user = await createUser();
    const account = await createAccount();
    await createLoan({ accountId: account.id, recordedById: user.id, principal: 1000, interestRatePct: 0, currency: "USD" });
    await createPayable({ recordedById: user.id, amount: 250, currency: "USD" });

    const stats = await getFinanceStats();
    expect(stats.outstandingLoans.USD).toBeCloseTo(1000, 1);
    expect(stats.outstandingPayables.USD).toBe(250);
  });
});

describe("getRecentActivity", () => {
  it("merges recent items across cases, payments, and expenses, newest first", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase();
    const visaApplication = await createVisaApplication({ caseId: kase.id });
    await createPayment({
      visaApplicationId: visaApplication.id,
      receivedById: user.id,
      accountId: account.id,
    });
    await createExpense(
      { caseId: kase.id, category: "Fuel", amount: 10, currency: "USD", accountId: account.id },
      user.id,
    );

    const activity = await getRecentActivity(15);

    const types = activity.map((a) => a.type);
    expect(types).toContain("CASE_CREATED");
    expect(types).toContain("PAYMENT_RECEIVED");
    expect(types).toContain("EXPENSE_PAID");
    for (let i = 1; i < activity.length; i++) {
      expect(new Date(activity[i - 1].occurredAt).getTime()).toBeGreaterThanOrEqual(
        new Date(activity[i].occurredAt).getTime(),
      );
    }
  });

  it("respects the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await createCase();
    }
    const activity = await getRecentActivity(3);
    expect(activity).toHaveLength(3);
  });
});
