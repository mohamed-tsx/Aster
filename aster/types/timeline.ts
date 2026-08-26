export type CaseTimelineItemType =
  | "CASE_STATUS_EVENT"
  | "NOTE"
  | "PAYMENT_RECEIVED"
  | "EXPENSE_PAID"
  | "REFUND_ISSUED"
  | "DOCUMENT_UPLOADED";

export type TimelineActor = { id: string; firstName: string; lastName: string } | null;

export type CaseTimelineItem = {
  type: CaseTimelineItemType;
  occurredAt: string;
  actor: TimelineActor;
  // CASE_STATUS_EVENT
  subtype?: "CASE_CREATED" | "CASE_STATUS_CHANGED" | "VISA_STATUS_CHANGED" | "INQUIRY_STATUS_CHANGED";
  fromStatus?: string | null;
  toStatus?: string;
  // NOTE
  body?: string;
  // PAYMENT_RECEIVED / EXPENSE_PAID / REFUND_ISSUED
  amount?: string;
  currency?: "USD" | "INR";
  category?: string;
  reason?: string;
  travelerType?: "PATIENT" | "ATTENDANT";
  // DOCUMENT_UPLOADED
  fileName?: string;
};
