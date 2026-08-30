import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { markEmbassyVisited, recordFeePaymentByTraveler } from "../../Src/Services/Cases/casesService.js";
import { getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import { EMBASSY_PARTNERSHIP_COMMISSION_CATEGORY } from "../../Src/Services/Expenses/expensesService.js";
import { createUser, createAccount, createCase, createHospital, recordChosenResponseFor } from "../helpers/factories.js";

const readyForEmbassy = async (user, account) => {
  const kase = await createCase();
  await recordChosenResponseFor(kase.id, { user });
  const visa = await recordFeePaymentByTraveler(kase.id, { travelerType: "PATIENT", accountId: account.id, amount: 100 }, user.id);
  return { kase, visaId: visa.id };
};

describe("markEmbassyVisited — partner commission", () => {
  it("records a commission expense in the same step", async () => {
    const user = await createUser();
    const account = await createAccount();
    const { kase, visaId } = await readyForEmbassy(user, account);

    await markEmbassyVisited(
      kase.id, visaId,
      { embassyVisitDate: "2026-04-01", partnerCommission: { amount: 40, accountId: account.id } },
      user.id,
    );

    const expense = await Prisma.expense.findFirst({ where: { visaApplicationId: visaId, category: EMBASSY_PARTNERSHIP_COMMISSION_CATEGORY } });
    expect(expense).not.toBeNull();
    expect(Number(expense.amount)).toBe(40);
    const balances = await getAccountBalances(account.id);
    // +100 fee - 40 commission = 60
    expect(balances.USD).toBe(60);
  });

  it("works with no commission (unchanged path)", async () => {
    const user = await createUser();
    const account = await createAccount();
    const { kase, visaId } = await readyForEmbassy(user, account);
    const updated = await markEmbassyVisited(kase.id, visaId, { embassyVisitDate: "2026-04-01" }, user.id);
    expect(updated.status).toBe("EMBASSY_VISITED");
    const expense = await Prisma.expense.findFirst({ where: { visaApplicationId: visaId } });
    expect(expense).toBeNull();
  });

  it("rejects a commission with no account", async () => {
    const user = await createUser();
    const account = await createAccount();
    const { kase, visaId } = await readyForEmbassy(user, account);
    await expect(
      markEmbassyVisited(kase.id, visaId, { embassyVisitDate: "2026-04-01", partnerCommission: { amount: 40 } }, user.id),
    ).rejects.toThrow(/account/i);
  });

  it("treats a zero commission as no commission", async () => {
    const user = await createUser();
    const account = await createAccount();
    const { kase, visaId } = await readyForEmbassy(user, account);
    const updated = await markEmbassyVisited(
      kase.id, visaId,
      { embassyVisitDate: "2026-04-01", partnerCommission: { amount: "0" } },
      user.id,
    );
    expect(updated.status).toBe("EMBASSY_VISITED");
    expect(await Prisma.expense.findFirst({ where: { visaApplicationId: visaId } })).toBeNull();
  });

  it("rejects a non-numeric commission amount with a 400 rather than skipping it", async () => {
    const user = await createUser();
    const account = await createAccount();
    const { kase, visaId } = await readyForEmbassy(user, account);
    await expect(
      markEmbassyVisited(
        kase.id, visaId,
        { embassyVisitDate: "2026-04-01", partnerCommission: { amount: "abc", accountId: account.id } },
        user.id,
      ),
    ).rejects.toMatchObject({ statusCode: 400, errorCode: "VALIDATION_ERROR" });
  });
});
