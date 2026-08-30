import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { createLoan, recordLoanRepayment, listLoans, getLoanById } from "../../Src/Services/Loans/loansService.js";
import { getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import { createUser, createAccount } from "../helpers/factories.js";

const base = (o = {}) => ({
  lenderName: "Bank X", principal: 1000, currency: "USD", interestRatePct: 12,
  interestMethod: "SIMPLE", disbursedOn: "2026-01-01", termMonths: 12, ...o,
});

describe("createLoan", () => {
  it("stores terms, computes dueOn, credits the account", async () => {
    const user = await createUser();
    const account = await createAccount();
    const loan = await createLoan(base({ accountId: account.id }), user.id);
    expect(new Date(loan.dueOn).toISOString().slice(0, 10)).toBe("2027-01-01");
    expect(loan.status).toBe("ACTIVE");
    const balances = await getAccountBalances(account.id);
    expect(balances.USD).toBe(1000);
    const txn = await Prisma.accountTransaction.findFirst({ where: { loanId: loan.id } });
    expect(txn.type).toBe("LOAN_RECEIVED");
  });

  it("rejects bad amount / currency / method", async () => {
    const user = await createUser();
    const account = await createAccount();
    await expect(createLoan(base({ principal: 0, accountId: account.id }), user.id)).rejects.toThrow(AppError);
    await expect(createLoan(base({ currency: "GBP", accountId: account.id }), user.id)).rejects.toThrow(AppError);
    await expect(createLoan(base({ interestMethod: "WEEKLY", accountId: account.id }), user.id)).rejects.toThrow(AppError);
  });
});

describe("recordLoanRepayment", () => {
  it("debits the account and settles the loan when paid off", async () => {
    const user = await createUser();
    const account = await createAccount({ });
    // seed the account so it can go negative-free is not required; balances may go negative
    const loan = await createLoan(base({ accountId: account.id }), user.id);
    await recordLoanRepayment(loan.id, { amount: 500, paidOn: "2026-06-01", accountId: account.id }, user.id);
    let fresh = await getLoanById(loan.id);
    expect(fresh.status).toBe("ACTIVE");
    expect(fresh.repayments).toHaveLength(1);

    await recordLoanRepayment(loan.id, { amount: 1000, paidOn: "2027-02-01", accountId: account.id }, user.id);
    fresh = await getLoanById(loan.id);
    expect(fresh.status).toBe("SETTLED");
    expect(fresh.projection.outstanding).toBe(0);
  });

  it("rejects a repayment on a settled loan", async () => {
    const user = await createUser();
    const account = await createAccount();
    const loan = await createLoan(base({ accountId: account.id }), user.id);
    await recordLoanRepayment(loan.id, { amount: 5000, paidOn: "2027-02-01", accountId: account.id }, user.id);
    await expect(
      recordLoanRepayment(loan.id, { amount: 1, paidOn: "2027-03-01", accountId: account.id }, user.id),
    ).rejects.toThrow(/already settled/i);
  });
});

describe("listLoans", () => {
  it("filters by status and carries a projection", async () => {
    const user = await createUser();
    const account = await createAccount();
    await createLoan(base({ accountId: account.id }), user.id);
    const res = await listLoans({ page: 1, limit: 20, status: "ACTIVE" });
    expect(res.loans[0].projection).toHaveProperty("outstanding");
  });
});
