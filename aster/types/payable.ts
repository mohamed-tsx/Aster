export type PayableStatus = "OUTSTANDING" | "SETTLED";

export type Payable = {
  id: string;
  payeeName: string;
  amount: string;
  currency: "USD" | "INR";
  reason: string;
  raisedOn: string;
  status: PayableStatus;
  settledOn: string | null;
  caseId: string | null;
  case: { id: string; caseNumber: string } | null;
  recordedBy: { id: string; firstName: string; lastName: string };
  accountTransaction: { account: { id: string; name: string } } | null;
  createdAt: string;
};

export type PayableListResult = {
  payables: Payable[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
