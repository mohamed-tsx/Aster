import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const CURRENCIES = ["USD", "INR"];

const INCLUDE = {
  case: { select: { id: true, caseNumber: true } },
  recordedBy: { select: { id: true, firstName: true, lastName: true } },
  accountTransaction: { select: { account: { select: { id: true, name: true } } } },
};

export const createPayable = async (data, userId) => {
  const { payeeName, amount, currency, reason, raisedOn, caseId } = data;
  if (!payeeName?.trim()) throw new AppError("payeeName is required", 400, "VALIDATION_ERROR");
  if (amount === undefined || amount === null || amount === "" || Number(amount) <= 0) {
    throw new AppError("amount must be a positive number", 400, "VALIDATION_ERROR");
  }
  if (!CURRENCIES.includes(currency)) throw new AppError(`currency must be one of: ${CURRENCIES.join(", ")}`, 400, "VALIDATION_ERROR");
  if (!reason?.trim()) throw new AppError("reason is required", 400, "VALIDATION_ERROR");
  const raised = new Date(raisedOn);
  if (Number.isNaN(raised.getTime())) throw new AppError("raisedOn is not a valid date", 400, "VALIDATION_ERROR");
  if (caseId) {
    const kase = await Prisma.case.findUnique({ where: { id: caseId } });
    if (!kase) throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  return Prisma.payable.create({
    data: {
      payeeName: payeeName.trim(),
      amount,
      currency,
      reason: reason.trim(),
      raisedOn: raised,
      case: caseId ? { connect: { id: caseId } } : undefined,
      recordedBy: { connect: { id: userId } },
    },
    include: INCLUDE,
  });
};

export const settlePayable = async (id, data, userId) => {
  const { accountId, paidOn } = data;
  const payable = await Prisma.payable.findUnique({ where: { id } });
  if (!payable) throw new AppError("Payable not found", 404, "NOT_FOUND");
  if (payable.status === "SETTLED") throw new AppError("This payable is already settled", 400, "VALIDATION_ERROR");
  const paid = new Date(paidOn);
  if (Number.isNaN(paid.getTime())) throw new AppError("paidOn is not a valid date", 400, "VALIDATION_ERROR");
  if (!accountId) throw new AppError("accountId is required", 400, "VALIDATION_ERROR");
  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found", 404, "NOT_FOUND");

  const [, updated] = await Prisma.$transaction([
    Prisma.accountTransaction.create({
      data: {
        accountId,
        type: "PAYABLE_SETTLED",
        amount: payable.amount,
        currency: payable.currency,
        notes: `Settled payable to ${payable.payeeName}`,
        createdById: userId,
        occurredAt: paid,
        payableId: id,
      },
    }),
    Prisma.payable.update({ where: { id }, data: { status: "SETTLED", settledOn: paid }, include: INCLUDE }),
  ]);
  return updated;
};

export const listPayables = async ({ page = 1, limit = 20, status, caseId } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (caseId) where.caseId = caseId;
  const [payables, total] = await Promise.all([
    Prisma.payable.findMany({ where, include: INCLUDE, orderBy: { raisedOn: "desc" }, skip: (page - 1) * limit, take: limit }),
    Prisma.payable.count({ where }),
  ]);
  return { payables, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};
