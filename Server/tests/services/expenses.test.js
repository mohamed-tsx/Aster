import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { createExpense, listExpenses } from "../../Src/Services/Expenses/expensesService.js";
import { getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import { createUser, createAccount, createCase } from "../helpers/factories.js";

describe("createExpense", () => {
  it("creates an expense tied to a case and debits the account", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase();

    const expense = await createExpense(
      {
        caseId: kase.id,
        category: "Embassy fee",
        amount: 50,
        currency: "USD",
        accountId: account.id,
        notes: "Paid at embassy counter",
      },
      user.id,
    );

    expect(expense.category).toBe("Embassy fee");
    expect(Number(expense.amount)).toBe(50);
    expect(expense.caseId).toBe(kase.id);
    expect(expense.paidById).toBe(user.id);

    const balances = await getAccountBalances(account.id);
    expect(balances.USD).toBe(-50);
  });

  it("creates a general expense with no case", async () => {
    const user = await createUser();
    const account = await createAccount();

    const expense = await createExpense(
      { category: "Office supplies", amount: 20, currency: "USD", accountId: account.id },
      user.id,
    );

    expect(expense.caseId).toBeNull();
  });

  it("rejects a blank category", async () => {
    const user = await createUser();
    const account = await createAccount();

    await expect(
      createExpense({ category: "  ", amount: 20, currency: "USD", accountId: account.id }, user.id),
    ).rejects.toThrow(AppError);
  });

  it("rejects a non-positive amount", async () => {
    const user = await createUser();
    const account = await createAccount();

    await expect(
      createExpense({ category: "Fuel", amount: 0, currency: "USD", accountId: account.id }, user.id),
    ).rejects.toThrow(AppError);
  });

  it("rejects an unknown account", async () => {
    const user = await createUser();

    await expect(
      createExpense(
        { category: "Fuel", amount: 20, currency: "USD", accountId: "does-not-exist" },
        user.id,
      ),
    ).rejects.toThrow(AppError);
  });

  it("rejects an expense on a cancelled case", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase({ status: "CANCELLED" });

    await expect(
      createExpense(
        { caseId: kase.id, category: "Fuel", amount: 20, currency: "USD", accountId: account.id },
        user.id,
      ),
    ).rejects.toThrow("This case has been cancelled");
  });
});

describe("listExpenses", () => {
  it("filters by caseId when provided", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kaseA = await createCase();
    const kaseB = await createCase();

    await createExpense(
      { caseId: kaseA.id, category: "A", amount: 10, currency: "USD", accountId: account.id },
      user.id,
    );
    await createExpense(
      { caseId: kaseB.id, category: "B", amount: 10, currency: "USD", accountId: account.id },
      user.id,
    );

    const result = await listExpenses({ caseId: kaseA.id, page: 1, limit: 20 });
    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0].category).toBe("A");
  });
});
