import { describe, it, expect } from "vitest";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { issueRefund } from "../../Src/Services/Cases/casesService.js";
import { getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import {
  createUser,
  createAccount,
  createCase,
  createVisaApplication,
  createPayment,
} from "../helpers/factories.js";

const setupPaidVisaApplication = async (amount = 100) => {
  const user = await createUser();
  const account = await createAccount();
  const kase = await createCase();
  const visaApplication = await createVisaApplication({ caseId: kase.id });
  const payment = await createPayment({
    visaApplicationId: visaApplication.id,
    receivedById: user.id,
    accountId: account.id,
    amount,
  });
  return { user, account, kase, visaApplication, payment };
};

describe("issueRefund", () => {
  it("issues a partial refund and debits the account", async () => {
    const { user, account, kase, visaApplication } = await setupPaidVisaApplication(100);

    const refund = await issueRefund(
      kase.id,
      visaApplication.id,
      { accountId: account.id, amount: 30, reason: "Visa rejected, partial refund" },
      user.id,
    );

    expect(Number(refund.amount)).toBe(30);
    expect(refund.reason).toBe("Visa rejected, partial refund");
    expect(refund.refundedById).toBe(user.id);

    const balances = await getAccountBalances(account.id);
    // +100 payment received, -30 refund issued
    expect(balances.USD).toBe(70);
  });

  it("rejects a refund exceeding the remaining refundable balance", async () => {
    const { user, account, kase, visaApplication } = await setupPaidVisaApplication(100);

    await issueRefund(
      kase.id,
      visaApplication.id,
      { accountId: account.id, amount: 60, reason: "First refund" },
      user.id,
    );

    await expect(
      issueRefund(
        kase.id,
        visaApplication.id,
        { accountId: account.id, amount: 50, reason: "Second refund" },
        user.id,
      ),
    ).rejects.toThrow(AppError);
  });

  it("rejects a refund when no payment has been recorded", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase();
    const visaApplication = await createVisaApplication({ caseId: kase.id });

    await expect(
      issueRefund(
        kase.id,
        visaApplication.id,
        { accountId: account.id, amount: 10, reason: "No payment yet" },
        user.id,
      ),
    ).rejects.toThrow("No payment has been recorded");
  });

  it("rejects a blank reason", async () => {
    const { user, account, kase, visaApplication } = await setupPaidVisaApplication(100);

    await expect(
      issueRefund(kase.id, visaApplication.id, { accountId: account.id, amount: 10, reason: "  " }, user.id),
    ).rejects.toThrow(AppError);
  });

  it("allows a refund on a cancelled case", async () => {
    const { user, account, kase, visaApplication } = await setupPaidVisaApplication(100);
    await import("../../Src/Config/Prisma/db.js").then(({ default: Prisma }) =>
      Prisma.case.update({ where: { id: kase.id }, data: { status: "CANCELLED" } }),
    );

    const refund = await issueRefund(
      kase.id,
      visaApplication.id,
      { accountId: account.id, amount: 25, reason: "Case cancelled, refunding fee" },
      user.id,
    );

    expect(Number(refund.amount)).toBe(25);
  });
});
