import type { CaseStatus } from "@/types/case";

export type CaseStats = {
  statusCounts: Record<CaseStatus, number>;
  pendingInquiries: number;
  visasAwaitingFee: number;
  visasAwaitingEmbassyVisit: number;
  visasAwaitingOutcome: number;
};

export type FinanceStats = {
  totalBalances: Record<string, number>;
  accountCount: number;
  outstandingLoans: Record<string, number>;
  outstandingPayables: Record<string, number>;
};

export type ActivityType =
  | "CASE_CREATED"
  | "PAYMENT_RECEIVED"
  | "EXPENSE_PAID"
  | "REFUND_ISSUED"
  | "DOCUMENT_UPLOADED";

export type ExpiringPassport = {
  caseId: string;
  caseNumber: string;
  travelerType: "PATIENT" | "ATTENDANT";
  travelerId: string;
  name: string;
  passportExpiry: string;
};

export type ActivityItem = {
  type: ActivityType;
  occurredAt: string;
  caseId: string | null;
  caseNumber: string | null;
  amount?: string;
  currency?: "USD" | "INR";
  category?: string;
  fileName?: string;
};
