import { describe, it, expect } from "vitest";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { createAccount, getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import { createExpense } from "../../Src/Services/Expenses/expensesService.js";
import { createUser, createCase, createVisaApplication, createPayment } from "../helpers/factories.js";

describe("createAccount", () => {
  it("seeds an opening balance as an OPENING_BALANCE credit", async () => {
    const user = await createUser();

    const account = await createAccount(
      { name: "Cash Box", type: "CASH", openingBalances: [{ currency: "USD", amount: 500 }] },
      user.id,
    );

    expect(account.balances.USD).toBe(500);
  });

  it("rejects a duplicate account name", async () => {
    const user = await createUser();
    await createAccount({ name: "Main Bank", type: "BANK" }, user.id);

    await expect(createAccount({ name: "Main Bank", type: "BANK" }, user.id)).rejects.toThrow(AppError);
  });
});

describe("getAccountBalances", () => {
  it("nets credits and debits per currency, independent of other currencies", async () => {
    const user = await createUser();
    const account = await createAccount(
      {
        name: "Multi-currency",
        type: "BANK",
        openingBalances: [
          { currency: "USD", amount: 1000 },
          { currency: "INR", amount: 2000 },
        ],
      },
      user.id,
    );

    const kase = await createCase();
    const visaApplication = await createVisaApplication({ caseId: kase.id });
    await createPayment({
      visaApplicationId: visaApplication.id,
      receivedById: user.id,
      accountId: account.id,
      amount: 200,
      currency: "USD",
    });
    await createExpense(
      { category: "Rent", amount: 300, currency: "INR", accountId: account.id },
      user.id,
    );

    const balances = await getAccountBalances(account.id);

    expect(balances.USD).toBe(1200);
    expect(balances.INR).toBe(1700);
  });
});
