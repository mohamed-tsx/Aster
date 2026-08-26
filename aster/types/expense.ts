export type ExpenseCase = { id: string; caseNumber: string };
export type ExpenseVisaApplication = { id: string; travelerType: "PATIENT" | "ATTENDANT" };
export type ExpensePaidBy = { id: string; firstName: string; lastName: string };
export type ExpenseAccount = { id: string; name: string };

export type Expense = {
  id: string;
  category: string;
  amount: string;
  currency: "USD" | "INR";
  notes: string | null;
  caseId: string | null;
  case: ExpenseCase | null;
  visaApplicationId: string | null;
  visaApplication: ExpenseVisaApplication | null;
  paidById: string;
  paidBy: ExpensePaidBy;
  accountTransaction: { account: ExpenseAccount } | null;
  incurredAt: string;
  createdAt: string;
};

export type ExpensesListResult = {
  expenses: Expense[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
