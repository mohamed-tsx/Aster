import type { RevenueCategory } from "@/types/revenue";

export type AccountType = "BANK" | "CASH" | "OTHER";

export type AccountBalances = Record<string, number>;

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  isActive: boolean;
  notes: string | null;
  balances: AccountBalances;
  createdAt: string;
  updatedAt: string;
};

export type AccountTransactionType =
  | "OPENING_BALANCE"
  | "PAYMENT_RECEIVED"
  | "EXPENSE_PAID"
  | "REFUND_ISSUED"
  | "REVENUE_RECEIVED"
  | "LOAN_RECEIVED"
  | "LOAN_REPAYMENT"
  | "PAYABLE_SETTLED";

export type AccountTransaction = {
  id: string;
  type: AccountTransactionType;
  amount: string;
  currency: "USD" | "INR";
  notes: string | null;
  occurredAt: string;
  createdBy: { id: string; firstName: string; lastName: string };
  payment: {
    id: string;
    visaApplication: { id: string; travelerType: string; case: { id: string; caseNumber: string } };
  } | null;
  expense: {
    id: string;
    category: string;
    case: { id: string; caseNumber: string } | null;
  } | null;
  refund: {
    id: string;
    reason: string;
    payment: { visaApplication: { case: { id: string; caseNumber: string } } };
  } | null;
  revenue: {
    id: string;
    category: RevenueCategory;
    case: { id: string; caseNumber: string } | null;
  } | null;
  loan: { id: string; lenderName: string } | null;
  loanRepayment: { id: string; loan: { id: string; lenderName: string } } | null;
  payable: { id: string; payeeName: string; reason: string } | null;
  /** Only present on the cross-account "all transactions" listing. */
  account?: { id: string; name: string };
};

export type AccountTransactionsListResult = {
  transactions: AccountTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
