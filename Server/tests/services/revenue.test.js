import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { createRevenue, listRevenue } from "../../Src/Services/Revenue/revenueService.js";
import { getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import { createUser, createAccount, createCase } from "../helpers/factories.js";

const base = (o = {}) => ({ category: "OTHER_INCOME", amount: 250, currency: "USD", receivedOn: "2026-03-01", ...o });

describe("createRevenue", () => {
  it("records revenue and credits the account", async () => {
    const user = await createUser();
    const account = await createAccount();
    const rev = await createRevenue(base({ accountId: account.id, description: "Sponsorship" }), user.id);
    expect(rev.category).toBe("OTHER_INCOME");
    expect(Number(rev.amount)).toBe(250);
    expect(rev.recordedById).toBe(user.id);
    const balances = await getAccountBalances(account.id);
    expect(balances.USD).toBe(250);
    const txn = await Prisma.accountTransaction.findFirst({ where: { revenueId: rev.id } });
    expect(txn.type).toBe("REVENUE_RECEIVED");
  });

  it("links referral commission to a case", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase();
    const rev = await createRevenue(
      base({ category: "HOSPITAL_REFERRAL_COMMISSION", accountId: account.id, caseId: kase.id }), user.id,
    );
    expect(rev.caseId).toBe(kase.id);
  });

  it("rejects a bad category, currency, amount, and unknown account/case", async () => {
    const user = await createUser();
    const account = await createAccount();
    await expect(createRevenue(base({ category: "NOPE", accountId: account.id }), user.id)).rejects.toThrow(AppError);
    await expect(createRevenue(base({ currency: "GBP", accountId: account.id }), user.id)).rejects.toThrow(AppError);
    await expect(createRevenue(base({ amount: 0, accountId: account.id }), user.id)).rejects.toThrow(AppError);
    await expect(createRevenue(base({ accountId: "nope" }), user.id)).rejects.toThrow("Account not found");
    await expect(createRevenue(base({ accountId: account.id, caseId: "nope" }), user.id)).rejects.toThrow("Case not found");
  });

  it("rejects a non-numeric amount with a 400 rather than a Prisma 500", async () => {
    const user = await createUser();
    const account = await createAccount();
    await expect(createRevenue(base({ amount: "abc", accountId: account.id }), user.id)).rejects.toMatchObject({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "amount must be a positive number",
    });
  });
});

describe("listRevenue", () => {
  it("filters by category", async () => {
    const user = await createUser();
    const account = await createAccount();
    await createRevenue(base({ category: "OTHER_INCOME", accountId: account.id }), user.id);
    await createRevenue(base({ category: "HOSPITAL_REFERRAL_COMMISSION", accountId: account.id }), user.id);
    const res = await listRevenue({ page: 1, limit: 20, category: "HOSPITAL_REFERRAL_COMMISSION" });
    expect(res.revenue).toHaveLength(1);
  });
});
