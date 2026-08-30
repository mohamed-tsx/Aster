export type RevenueCategory = "HOSPITAL_REFERRAL_COMMISSION" | "OTHER_INCOME";

export type Revenue = {
  id: string;
  category: RevenueCategory;
  amount: string;
  currency: "USD" | "INR";
  description: string | null;
  receivedOn: string;
  caseId: string | null;
  case: { id: string; caseNumber: string } | null;
  account: { id: string; name: string };
  recordedBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
};

export type RevenueListResult = {
  revenue: Revenue[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
