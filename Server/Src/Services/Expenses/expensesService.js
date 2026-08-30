import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const CURRENCIES = ["USD", "INR"];

export const EMBASSY_PARTNERSHIP_COMMISSION_CATEGORY = "Embassy partnership commission";

const EXPENSE_LIST_INCLUDE = {
  case: { select: { id: true, caseNumber: true } },
  visaApplication: { select: { id: true, travelerType: true } },
  paidBy: { select: { id: true, firstName: true, lastName: true } },
  accountTransaction: { select: { account: { select: { id: true, name: true } } } },
};

/**
 * @param {{ page?: number, limit?: number, caseId?: string }} params
 */
export const listExpenses = async ({ page = 1, limit = 20, caseId } = {}) => {
  const where = caseId ? { caseId } : {};

  const [expenses, total] = await Promise.all([
    Prisma.expense.findMany({
      where,
      include: EXPENSE_LIST_INCLUDE,
      orderBy: { incurredAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    Prisma.expense.count({ where }),
  ]);

  return { expenses, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

/**
 * @param {{ caseId?: string, visaApplicationId?: string, category: string, amount: number|string, currency: string, accountId: string, notes?: string }} data
 * @param {string} userId
 */
export const createExpense = async (data, userId) => {
  const { caseId, visaApplicationId, category, amount, currency, accountId, notes } = data;

  if (!category?.trim()) {
    throw new AppError("category is required", 400, "VALIDATION_ERROR");
  }
  if (amount === undefined || amount === null || amount === "" || Number(amount) <= 0) {
    throw new AppError("amount must be a positive number", 400, "VALIDATION_ERROR");
  }
  if (!CURRENCIES.includes(currency)) {
    throw new AppError(`currency must be one of: ${CURRENCIES.join(", ")}`, 400, "VALIDATION_ERROR");
  }
  if (!accountId) {
    throw new AppError("accountId is required", 400, "VALIDATION_ERROR");
  }

  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new AppError("Account not found", 404, "NOT_FOUND");
  }

  if (caseId) {
    const kase = await Prisma.case.findUnique({ where: { id: caseId } });
    if (!kase) {
      throw new AppError("Case not found", 404, "NOT_FOUND");
    }
    if (kase.status === "CANCELLED") {
      throw new AppError("This case has been cancelled", 400, "VALIDATION_ERROR");
    }
  }

  if (visaApplicationId) {
    const visaApplication = await Prisma.visaApplication.findUnique({
      where: { id: visaApplicationId },
    });
    if (!visaApplication || (caseId && visaApplication.caseId !== caseId)) {
      throw new AppError("Visa application not found", 404, "NOT_FOUND");
    }
  }

  // Nested `accountTransaction: { create }` forces Prisma's "checked" create-input
  // shape (same gotcha documented next to `recordFeePayment` in casesService.js) —
  // sibling scalar FKs must be `connect`, not raw scalars.
  return Prisma.expense.create({
    data: {
      category: category.trim(),
      amount,
      currency,
      notes: notes?.trim() || null,
      case: caseId ? { connect: { id: caseId } } : undefined,
      visaApplication: visaApplicationId ? { connect: { id: visaApplicationId } } : undefined,
      paidBy: { connect: { id: userId } },
      accountTransaction: {
        create: {
          accountId,
          type: "EXPENSE_PAID",
          amount,
          currency,
          notes: notes?.trim() || null,
          createdById: userId,
        },
      },
    },
    include: EXPENSE_LIST_INCLUDE,
  });
};
