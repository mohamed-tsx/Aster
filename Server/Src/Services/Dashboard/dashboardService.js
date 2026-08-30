import Prisma from "../../Config/Prisma/db.js";
import { listAccounts } from "../Accounts/accountsService.js";
import { loanProjection } from "../Loans/loanProjection.js";

const CASE_STATUSES = [
  "NEW",
  "HOSPITAL_MATCHING",
  "HOSPITAL_ACCEPTED",
  "HOSPITAL_DECLINED",
  "VISA_PROCESSING",
  "COMPLETED",
  "CANCELLED",
];

export const getCaseStats = async () => {
  const [statusGroups, pendingInquiries, visasAwaitingFee, visasAwaitingEmbassyVisit, visasAwaitingOutcome] =
    await Promise.all([
      Prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
      Prisma.hospitalInquiry.count({ where: { status: "PENDING" } }),
      Prisma.visaApplication.count({ where: { status: "PENDING" } }),
      Prisma.visaApplication.count({ where: { status: "FEE_PAID" } }),
      Prisma.visaApplication.count({ where: { status: "EMBASSY_VISITED" } }),
    ]);

  const statusCounts = {};
  for (const status of CASE_STATUSES) statusCounts[status] = 0;
  for (const row of statusGroups) statusCounts[row.status] = row._count._all;

  return { statusCounts, pendingInquiries, visasAwaitingFee, visasAwaitingEmbassyVisit, visasAwaitingOutcome };
};

const FINANCE_CURRENCIES = ["USD", "INR"];

export const getFinanceStats = async () => {
  const accounts = await listAccounts();

  const totalBalances = {};
  for (const currency of FINANCE_CURRENCIES) totalBalances[currency] = 0;
  for (const account of accounts) {
    for (const currency of FINANCE_CURRENCIES) {
      totalBalances[currency] += account.balances[currency] || 0;
    }
  }

  const [loans, payables] = await Promise.all([
    Prisma.loan.findMany({ where: { status: "ACTIVE" }, include: { repayments: true } }),
    Prisma.payable.findMany({ where: { status: "OUTSTANDING" } }),
  ]);

  const outstandingLoans = {};
  const outstandingPayables = {};
  for (const currency of FINANCE_CURRENCIES) {
    outstandingLoans[currency] = 0;
    outstandingPayables[currency] = 0;
  }
  for (const loan of loans) {
    outstandingLoans[loan.currency] =
      (outstandingLoans[loan.currency] || 0) + loanProjection(loan, loan.repayments).outstanding;
  }
  for (const p of payables) {
    outstandingPayables[p.currency] = (outstandingPayables[p.currency] || 0) + Number(p.amount);
  }

  return { totalBalances, accountCount: accounts.length, outstandingLoans, outstandingPayables };
};

/**
 * Merges the last few timestamped events across Case/Payment/Expense/Refund/
 * Document creation — there's no dedicated audit-log table, so this composes
 * one from the tables that already carry a timestamp.
 * @param {number} limit
 */
export const getRecentActivity = async (limit = 15) => {
  const [cases, payments, expenses, refunds, documents] = await Promise.all([
    Prisma.case.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, caseNumber: true, createdAt: true },
    }),
    Prisma.payment.findMany({
      orderBy: { paidAt: "desc" },
      take: limit,
      select: {
        id: true,
        amount: true,
        currency: true,
        paidAt: true,
        visaApplication: { select: { case: { select: { id: true, caseNumber: true } } } },
      },
    }),
    Prisma.expense.findMany({
      orderBy: { incurredAt: "desc" },
      take: limit,
      select: {
        id: true,
        category: true,
        amount: true,
        currency: true,
        incurredAt: true,
        case: { select: { id: true, caseNumber: true } },
      },
    }),
    Prisma.refund.findMany({
      orderBy: { refundedAt: "desc" },
      take: limit,
      select: {
        id: true,
        amount: true,
        refundedAt: true,
        payment: {
          select: { visaApplication: { select: { case: { select: { id: true, caseNumber: true } } } } },
        },
      },
    }),
    Prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        fileName: true,
        createdAt: true,
        case: { select: { id: true, caseNumber: true } },
      },
    }),
  ]);

  const items = [
    ...cases.map((c) => ({
      type: "CASE_CREATED",
      occurredAt: c.createdAt,
      caseId: c.id,
      caseNumber: c.caseNumber,
    })),
    ...payments.map((p) => ({
      type: "PAYMENT_RECEIVED",
      occurredAt: p.paidAt,
      amount: p.amount,
      currency: p.currency,
      caseId: p.visaApplication.case.id,
      caseNumber: p.visaApplication.case.caseNumber,
    })),
    ...expenses.map((e) => ({
      type: "EXPENSE_PAID",
      occurredAt: e.incurredAt,
      amount: e.amount,
      currency: e.currency,
      category: e.category,
      caseId: e.case?.id ?? null,
      caseNumber: e.case?.caseNumber ?? null,
    })),
    ...refunds.map((r) => ({
      type: "REFUND_ISSUED",
      occurredAt: r.refundedAt,
      amount: r.amount,
      caseId: r.payment.visaApplication.case.id,
      caseNumber: r.payment.visaApplication.case.caseNumber,
    })),
    ...documents.map((d) => ({
      type: "DOCUMENT_UPLOADED",
      occurredAt: d.createdAt,
      fileName: d.fileName,
      caseId: d.case.id,
      caseNumber: d.case.caseNumber,
    })),
  ];

  items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return items.slice(0, limit);
};

const ACTIVE_CASE_STATUSES = {
  notIn: ["CANCELLED", "COMPLETED"],
};

/**
 * Patients/attendants on active (not cancelled/completed) cases whose
 * passport expires within `days` from now.
 * @param {number} days
 */
export const getExpiringPassports = async (days = 90) => {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  const [patientCases, attendantCases] = await Promise.all([
    Prisma.case.findMany({
      where: {
        status: ACTIVE_CASE_STATUSES,
        patient: { passportExpiry: { gte: now, lte: cutoff } },
      },
      select: {
        id: true,
        caseNumber: true,
        patient: { select: { id: true, firstName: true, lastName: true, passportExpiry: true } },
      },
    }),
    Prisma.case.findMany({
      where: {
        status: ACTIVE_CASE_STATUSES,
        attendant: { passportExpiry: { gte: now, lte: cutoff } },
      },
      select: {
        id: true,
        caseNumber: true,
        attendant: { select: { id: true, firstName: true, lastName: true, passportExpiry: true } },
      },
    }),
  ]);

  const results = [
    ...patientCases.map((c) => ({
      caseId: c.id,
      caseNumber: c.caseNumber,
      travelerType: "PATIENT",
      travelerId: c.patient.id,
      name: `${c.patient.firstName} ${c.patient.lastName}`,
      passportExpiry: c.patient.passportExpiry,
    })),
    ...attendantCases.map((c) => ({
      caseId: c.id,
      caseNumber: c.caseNumber,
      travelerType: "ATTENDANT",
      travelerId: c.attendant.id,
      name: `${c.attendant.firstName} ${c.attendant.lastName}`,
      passportExpiry: c.attendant.passportExpiry,
    })),
  ];

  results.sort((a, b) => new Date(a.passportExpiry).getTime() - new Date(b.passportExpiry).getTime());
  return results;
};
