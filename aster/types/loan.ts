export type LoanInterestMethod = "SIMPLE" | "COMPOUND_MONTHLY";
export type LoanStatus = "ACTIVE" | "SETTLED";

export type LoanProjection = {
  accruedInterest: number;
  totalRepaid: number;
  outstanding: number;
  isOverdue: boolean;
};

export type LoanRepayment = {
  id: string;
  amount: string;
  paidOn: string;
  account: { id: string; name: string };
  createdAt: string;
};

export type Loan = {
  id: string;
  lenderName: string;
  principal: string;
  currency: "USD" | "INR";
  interestRatePct: string;
  interestMethod: LoanInterestMethod;
  disbursedOn: string;
  termMonths: number;
  dueOn: string;
  status: LoanStatus;
  notes: string | null;
  account: { id: string; name: string };
  recordedBy: { id: string; firstName: string; lastName: string };
  repayments: LoanRepayment[];
  projection: LoanProjection;
  createdAt: string;
};

export type LoanListResult = {
  loans: Loan[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
