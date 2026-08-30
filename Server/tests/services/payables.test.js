import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { createPayable, settlePayable, listPayables } from "../../Src/Services/Payables/payablesService.js";
import { getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import { createUser, createAccount, createCase } from "../helpers/factories.js";

const base = (o = {}) => ({ payeeName: "Ali", amount: 300, currency: "USD", reason: "Overpayment", raisedOn: "2026-03-01", ...o });

describe("payables", () => {
  it("creates a payable with no ledger movement", async () => {
    const user = await createUser();
    const account = await createAccount();
    const p = await createPayable(base(), user.id);
    expect(p.status).toBe("OUTSTANDING");
    const balances = await getAccountBalances(account.id);
    expect(balances.USD).toBe(0);
  });

  it("links to a case when given", async () => {
    const user = await createUser();
    const kase = await createCase();
    const p = await createPayable(base({ caseId: kase.id }), user.id);
    expect(p.caseId).toBe(kase.id);
  });

  it("settles from an account and cannot be settled twice", async () => {
    const user = await createUser();
    const account = await createAccount();
    const p = await createPayable(base(), user.id);
    await settlePayable(p.id, { accountId: account.id, paidOn: "2026-03-15" }, user.id);
    const fresh = await Prisma.payable.findUnique({ where: { id: p.id } });
    expect(fresh.status).toBe("SETTLED");
    expect(fresh.settledOn).not.toBeNull();
    const balances = await getAccountBalances(account.id);
    expect(balances.USD).toBe(-300);
    await expect(settlePayable(p.id, { accountId: account.id, paidOn: "2026-03-16" }, user.id)).rejects.toThrow(/already settled/i);
  });

  it("rejects a bad amount / currency and unknown case/account", async () => {
    const user = await createUser();
    await expect(createPayable(base({ amount: 0 }), user.id)).rejects.toThrow(AppError);
    await expect(createPayable(base({ currency: "GBP" }), user.id)).rejects.toThrow(AppError);
    await expect(createPayable(base({ amount: "abc" }), user.id)).rejects.toMatchObject({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "amount must be a positive number",
    });
    await expect(createPayable(base({ caseId: "nope" }), user.id)).rejects.toThrow("Case not found");
    const p = await createPayable(base(), user.id);
    await expect(settlePayable(p.id, { accountId: "nope", paidOn: "2026-03-15" }, user.id)).rejects.toThrow("Account not found");
  });
});

describe("listPayables", () => {
  it("filters by status", async () => {
    const user = await createUser();
    const account = await createAccount();
    const p1 = await createPayable(base(), user.id);
    await createPayable(base(), user.id);
    await settlePayable(p1.id, { accountId: account.id, paidOn: "2026-03-15" }, user.id);
    const res = await listPayables({ page: 1, limit: 20, status: "OUTSTANDING" });
    expect(res.payables).toHaveLength(1);
  });
});
