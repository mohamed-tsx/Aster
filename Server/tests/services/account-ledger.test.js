import { describe, it, expect } from "vitest";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { listAccountTransactions } from "../../Src/Services/Accounts/accountsService.js";
import { createExpense } from "../../Src/Services/Expenses/expensesService.js";
import {
  createUser,
  createAccount,
  createCase,
  createVisaApplication,
  createPayment,
} from "../helpers/factories.js";

describe("listAccountTransactions", () => {
  it("lists an account's transactions newest first, with linked case/payment context", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase();
    const visaApplication = await createVisaApplication({ caseId: kase.id });

    await createPayment({
      visaApplicationId: visaApplication.id,
      receivedById: user.id,
      accountId: account.id,
      amount: 100,
    });
    await createExpense(
      { caseId: kase.id, category: "Embassy fee", amount: 40, currency: "USD", accountId: account.id },
      user.id,
    );

    const result = await listAccountTransactions(account.id, { page: 1, limit: 20 });

    expect(result.total).toBe(2);
    expect(result.transactions).toHaveLength(2);
    // newest first: expense was created after the payment
    expect(result.transactions[0].type).toBe("EXPENSE_PAID");
    expect(result.transactions[0].expense.category).toBe("Embassy fee");
    expect(result.transactions[0].expense.case.caseNumber).toBe(kase.caseNumber);
    expect(result.transactions[1].type).toBe("PAYMENT_RECEIVED");
    expect(result.transactions[1].payment.visaApplication.case.caseNumber).toBe(kase.caseNumber);
  });

  it("paginates", async () => {
    const user = await createUser();
    const account = await createAccount();
    for (let i = 0; i < 3; i++) {
      await createExpense(
        { category: `Expense ${i}`, amount: 10, currency: "USD", accountId: account.id },
        user.id,
      );
    }

    const page1 = await listAccountTransactions(account.id, { page: 1, limit: 2 });
    expect(page1.transactions).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page1.totalPages).toBe(2);

    const page2 = await listAccountTransactions(account.id, { page: 2, limit: 2 });
    expect(page2.transactions).toHaveLength(1);
  });

  it("rejects an unknown account", async () => {
    await expect(listAccountTransactions("does-not-exist", { page: 1, limit: 20 })).rejects.toThrow(
      AppError,
    );
  });
});
