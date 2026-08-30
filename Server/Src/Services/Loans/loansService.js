import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import {
  assertNonNegativeAmount,
  assertPositiveAmount,
} from "../../Utils/Validation/assertAmount.js";
import { loanProjection } from "./loanProjection.js";

const CURRENCIES = ["USD", "INR"];
const METHODS = ["SIMPLE", "COMPOUND_MONTHLY"];

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const LOAN_INCLUDE = {
  account: { select: { id: true, name: true } },
  recordedBy: { select: { id: true, firstName: true, lastName: true } },
  repayments: { orderBy: { paidOn: "asc" }, include: { account: { select: { id: true, name: true } } } },
};

export const createLoan = async (data, userId) => {
  const { lenderName, principal, currency, interestRatePct, interestMethod, disbursedOn, termMonths, notes, accountId } = data;

  if (!lenderName?.trim()) throw new AppError("lenderName is required", 400, "VALIDATION_ERROR");
  assertPositiveAmount(principal, "principal must be a positive number");
  if (!CURRENCIES.includes(currency)) throw new AppError(`currency must be one of: ${CURRENCIES.join(", ")}`, 400, "VALIDATION_ERROR");
  assertNonNegativeAmount(interestRatePct, "interestRatePct must be zero or a positive number");
  if (!METHODS.includes(interestMethod)) throw new AppError(`interestMethod must be one of: ${METHODS.join(", ")}`, 400, "VALIDATION_ERROR");
  if (!Number.isInteger(Number(termMonths)) || Number(termMonths) <= 0) {
    throw new AppError("termMonths must be a positive whole number", 400, "VALIDATION_ERROR");
  }
  const disbursed = new Date(disbursedOn);
  if (Number.isNaN(disbursed.getTime())) throw new AppError("disbursedOn is not a valid date", 400, "VALIDATION_ERROR");
  if (!accountId) throw new AppError("accountId is required", 400, "VALIDATION_ERROR");
  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found", 404, "NOT_FOUND");

  const dueOn = addMonths(disbursed, Number(termMonths));

  return Prisma.loan.create({
    data: {
      lenderName: lenderName.trim(),
      principal,
      currency,
      interestRatePct,
      interestMethod,
      disbursedOn: disbursed,
      termMonths: Number(termMonths),
      dueOn,
      notes: notes?.trim() || null,
      account: { connect: { id: accountId } },
      recordedBy: { connect: { id: userId } },
      accountTransaction: {
        create: {
          accountId,
          type: "LOAN_RECEIVED",
          amount: principal,
          currency,
          notes: `Loan from ${lenderName.trim()}`,
          createdById: userId,
          occurredAt: disbursed,
        },
      },
    },
    include: LOAN_INCLUDE,
  });
};

export const recordLoanRepayment = async (loanId, data, userId) => {
  const { amount, paidOn, accountId } = data;
  const loan = await Prisma.loan.findUnique({ where: { id: loanId }, include: { repayments: true } });
  if (!loan) throw new AppError("Loan not found", 404, "NOT_FOUND");
  if (loan.status === "SETTLED") throw new AppError("This loan is already settled", 400, "VALIDATION_ERROR");
  assertPositiveAmount(amount, "amount must be a positive number");
  const paid = new Date(paidOn);
  if (Number.isNaN(paid.getTime())) throw new AppError("paidOn is not a valid date", 400, "VALIDATION_ERROR");
  if (!accountId) throw new AppError("accountId is required", 400, "VALIDATION_ERROR");
  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found", 404, "NOT_FOUND");

  const repayment = await Prisma.loanRepayment.create({
    data: {
      loan: { connect: { id: loanId } },
      amount,
      paidOn: paid,
      account: { connect: { id: accountId } },
      recordedBy: { connect: { id: userId } },
      accountTransaction: {
        create: {
          accountId,
          type: "LOAN_REPAYMENT",
          amount,
          currency: loan.currency,
          notes: `Repayment to ${loan.lenderName}`,
          createdById: userId,
          occurredAt: paid,
        },
      },
    },
  });

  const projection = loanProjection(loan, [...loan.repayments, { amount }], paid);
  if (projection.outstanding <= 0) {
    await Prisma.loan.update({ where: { id: loanId }, data: { status: "SETTLED" } });
  }
  return repayment;
};

export const listLoans = async ({ page = 1, limit = 20, status } = {}) => {
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([
    Prisma.loan.findMany({ where, include: LOAN_INCLUDE, orderBy: { disbursedOn: "desc" }, skip: (page - 1) * limit, take: limit }),
    Prisma.loan.count({ where }),
  ]);
  const loans = rows.map((l) => ({ ...l, projection: loanProjection(l, l.repayments) }));
  return { loans, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

export const getLoanById = async (id) => {
  const loan = await Prisma.loan.findUnique({ where: { id }, include: LOAN_INCLUDE });
  if (!loan) throw new AppError("Loan not found", 404, "NOT_FOUND");
  return { ...loan, projection: loanProjection(loan, loan.repayments) };
};
