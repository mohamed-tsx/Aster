import type { Gender, Patient } from "@/types/patient";
import type { Agency } from "@/types/agency";
import type { Hospital } from "@/types/hospital";
import type { VisaApplication } from "@/types/visa";
import type { CaseDocument } from "@/types/document";
import type { Expense } from "@/types/expense";

export type Attendant = {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string | null;
  passportExpiry: string | null;
  phone: string;
  relationToPatient: string;
};

export type HospitalInquiryStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "NOT_SELECTED";

export type HospitalInquiry = {
  id: string;
  hospitalId: string;
  hospital: Hospital;
  status: HospitalInquiryStatus;
  isChosen: boolean;
  treatmentCostEstimate: string | null;
  currency: "USD" | "INR" | null;
  notes: string | null;
  sentAt: string;
  respondedAt: string | null;
  documents: CaseDocument[];
};

export type CaseStatus =
  | "NEW"
  | "HOSPITAL_MATCHING"
  | "HOSPITAL_ACCEPTED"
  | "HOSPITAL_DECLINED"
  | "VISA_PROCESSING"
  | "COMPLETED"
  | "CANCELLED";

export type ReachOutType = "DIRECT" | "AGENCY";

export type CaseAssignee = { id: string; firstName: string; lastName: string };

export type CaseListItem = {
  id: string;
  caseNumber: string;
  reachOutType: ReachOutType;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  patient: { id: string; firstName: string; lastName: string; passportNumber: string | null };
  agency: { id: string; name: string } | null;
  assignedTo: CaseAssignee | null;
};

export type Case = {
  id: string;
  caseNumber: string;
  reachOutType: ReachOutType;
  status: CaseStatus;
  notes: string | null;
  patient: Patient;
  attendant: Attendant | null;
  agency: Agency | null;
  assignedTo: (CaseAssignee & { username: string }) | null;
  inquiries: HospitalInquiry[];
  visaApplications: VisaApplication[];
  documents: CaseDocument[];
  expenses: Expense[];
  createdAt: string;
  updatedAt: string;
};

export type CasesListResult = {
  cases: CaseListItem[];
  total: number;
  page: number;
  limit: number;
};
