import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const ACCOUNT_TYPES = ["BANK", "CASH", "OTHER"];
const CURRENCIES = ["USD", "INR"];

export const CREDIT_TYPES = ["OPENING_BALANCE", "PAYMENT_RECEIVED"];
export const DEBIT_TYPES = ["EXPENSE_PAID", "REFUND_ISSUED"];

/**
 * The single place account balance is computed — never duplicate this math
 * elsewhere. A single Prisma `groupBy` can't net two directions of the same summed
 * column, so this runs one query per direction and merges them in JS.
 * @param {string} accountId
 * @returns {Promise<Record<string, number>>} e.g. { USD: 400, INR: 0 }
 */
export const getAccountBalances = async (accountId) => {
  const [credits, debits] = await Promise.all([
    Prisma.accountTransaction.groupBy({
      by: ["currency"],
      where: { accountId, type: { in: CREDIT_TYPES } },
      _sum: { amount: true },
    }),
    Prisma.accountTransaction.groupBy({
      by: ["currency"],
      where: { accountId, type: { in: DEBIT_TYPES } },
      _sum: { amount: true },
    }),
  ]);

  const balances = {};
  for (const currency of CURRENCIES) balances[currency] = 0;
  for (const row of credits) {
    balances[row.currency] = (balances[row.currency] || 0) + Number(row._sum.amount || 0);
  }
  for (const row of debits) {
    balances[row.currency] = (balances[row.currency] || 0) - Number(row._sum.amount || 0);
  }
  return balances;
};

const TRANSACTION_LIST_INCLUDE = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  payment: {
    select: {
      id: true,
      visaApplication: {
        select: { id: true, travelerType: true, case: { select: { id: true, caseNumber: true } } },
      },
    },
  },
  expense: {
    select: { id: true, category: true, case: { select: { id: true, caseNumber: true } } },
  },
  refund: {
    select: {
      id: true,
      reason: true,
      payment: {
        select: {
          visaApplication: {
            select: { case: { select: { id: true, caseNumber: true } } },
          },
        },
      },
    },
  },
};

/**
 * @param {string} accountId
 * @param {{ page?: number, limit?: number }} params
 */
export const listAccountTransactions = async (accountId, { page = 1, limit = 20 } = {}) => {
  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new AppError("Account not found", 404, "NOT_FOUND");
  }

  const where = { accountId };
  const [transactions, total] = await Promise.all([
    Prisma.accountTransaction.findMany({
      where,
      include: TRANSACTION_LIST_INCLUDE,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    Prisma.accountTransaction.count({ where }),
  ]);

  return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

/**
 * Same shape as `listAccountTransactions`, but across every account — for
 * the "every single transaction we made" report, not one account's ledger.
 * @param {{ page?: number, limit?: number }} params
 */
export const listAllAccountTransactions = async ({ page = 1, limit = 20 } = {}) => {
  const [transactions, total] = await Promise.all([
    Prisma.accountTransaction.findMany({
      include: { ...TRANSACTION_LIST_INCLUDE, account: { select: { id: true, name: true } } },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    Prisma.accountTransaction.count(),
  ]);

  return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

export const listAccounts = async () => {
  const accounts = await Prisma.account.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    accounts.map(async (account) => ({
      ...account,
      balances: await getAccountBalances(account.id),
    })),
  );
};

/**
 * @param {{ name: string, type: string, notes?: string, openingBalances?: { currency: string, amount: number|string }[] }} data
 * @param {string} userId
 */
export const createAccount = async (data, userId) => {
  const { name, type, notes, openingBalances } = data;

  if (!name?.trim()) {
    throw new AppError("Account name is required", 400, "VALIDATION_ERROR");
  }
  if (!ACCOUNT_TYPES.includes(type)) {
    throw new AppError(
      `type must be one of: ${ACCOUNT_TYPES.join(", ")}`,
      400,
      "VALIDATION_ERROR",
    );
  }

  const existing = await Prisma.account.findUnique({ where: { name: name.trim() } });
  if (existing) {
    throw new AppError("Account name already exists", 409, "CONFLICT");
  }

  const validOpeningBalances = [];
  if (Array.isArray(openingBalances)) {
    for (const entry of openingBalances) {
      if (!entry?.currency || !CURRENCIES.includes(entry.currency)) {
        throw new AppError(
          `Opening balance currency must be one of: ${CURRENCIES.join(", ")}`,
          400,
          "VALIDATION_ERROR",
        );
      }
      if (
        entry.amount === undefined ||
        entry.amount === null ||
        entry.amount === "" ||
        Number(entry.amount) <= 0
      ) {
        continue; // skip blank/zero entries rather than rejecting the whole request
      }
      validOpeningBalances.push(entry);
    }
  }

  const created = await Prisma.account.create({
    data: {
      name: name.trim(),
      type,
      notes: notes?.trim() || null,
      transactions: validOpeningBalances.length
        ? {
            create: validOpeningBalances.map((entry) => ({
              type: "OPENING_BALANCE",
              amount: entry.amount,
              currency: entry.currency,
              createdById: userId,
            })),
          }
        : undefined,
    },
  });

  return { ...created, balances: await getAccountBalances(created.id) };
};
