export type VisaApplicationStatus =
  | "PENDING"
  | "FEE_PAID"
  | "EMBASSY_VISITED"
  | "APPROVED"
  | "REJECTED";

export type TravelerType = "PATIENT" | "ATTENDANT";

import type { Refund } from "@/types/refund";

export type VisaFeePayment = {
  id: string;
  amount: string;
  currency: "USD" | "INR";
  feeType: "DIRECT" | "AGENCY";
  paidAt: string;
  refunds: Refund[];
};

export type VisaApplication = {
  id: string;
  caseId: string;
  travelerType: TravelerType;
  status: VisaApplicationStatus;
  visaNumber: string | null;
  embassyVisitDate: string | null;
  notes: string | null;
  payment: VisaFeePayment | null;
  createdAt: string;
  updatedAt: string;
};
