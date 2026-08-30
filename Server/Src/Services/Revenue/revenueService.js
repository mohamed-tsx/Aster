import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import { assertPositiveAmount } from "../../Utils/Validation/assertAmount.js";

const CURRENCIES = ["USD", "INR"];
const CATEGORIES = ["HOSPITAL_REFERRAL_COMMISSION", "OTHER_INCOME"];

const INCLUDE = {
  case: { select: { id: true, caseNumber: true } },
  account: { select: { id: true, name: true } },
  recordedBy: { select: { id: true, firstName: true, lastName: true } },
};

export const createRevenue = async (data, userId) => {
  const { category, amount, currency, accountId, caseId, description, receivedOn } = data;

  if (!CATEGORIES.includes(category)) {
    throw new AppError(`category must be one of: ${CATEGORIES.join(", ")}`, 400, "VALIDATION_ERROR");
  }
  assertPositiveAmount(amount, "amount must be a positive number");
  if (!CURRENCIES.includes(currency)) {
    throw new AppError(`currency must be one of: ${CURRENCIES.join(", ")}`, 400, "VALIDATION_ERROR");
  }
  if (!receivedOn) throw new AppError("receivedOn is required", 400, "VALIDATION_ERROR");
  const received = new Date(receivedOn);
  if (Number.isNaN(received.getTime())) throw new AppError("receivedOn is not a valid date", 400, "VALIDATION_ERROR");

  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found", 404, "NOT_FOUND");
  if (caseId) {
    const kase = await Prisma.case.findUnique({ where: { id: caseId } });
    if (!kase) throw new AppError("Case not found", 404, "NOT_FOUND");
  }

  return Prisma.revenue.create({
    data: {
      category,
      amount,
      currency,
      description: description?.trim() || null,
      receivedOn: received,
      case: caseId ? { connect: { id: caseId } } : undefined,
      account: { connect: { id: accountId } },
      recordedBy: { connect: { id: userId } },
      accountTransaction: {
        create: {
          accountId,
          type: "REVENUE_RECEIVED",
          amount,
          currency,
          notes: description?.trim() || null,
          createdById: userId,
          occurredAt: received,
        },
      },
    },
    include: INCLUDE,
  });
};

export const listRevenue = async ({ page = 1, limit = 20, caseId, category } = {}) => {
  const where = {};
  if (caseId) where.caseId = caseId;
  if (category) where.category = category;
  const [revenue, total] = await Promise.all([
    Prisma.revenue.findMany({ where, include: INCLUDE, orderBy: { receivedOn: "desc" }, skip: (page - 1) * limit, take: limit }),
    Prisma.revenue.count({ where }),
  ]);
  return { revenue, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};
