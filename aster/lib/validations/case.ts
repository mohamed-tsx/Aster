import { z } from "zod";

const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);

export const caseFormSchema = z.object({
  // Patient fields — required only when creating a new patient (no patientId selected).
  patientFirstName: z.string().max(100).optional(),
  patientLastName: z.string().max(100).optional(),
  patientGender: genderSchema.optional(),
  patientDateOfBirth: z.string().optional(),
  patientNationality: z.string().max(100).optional(),
  patientPassportNumber: z.string().max(50).optional(),
  patientPassportExpiry: z.string().optional(),
  patientPhone: z.string().max(30).optional(),
  patientEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  patientAddress: z.string().max(300).optional(),

  hasAttendant: z.boolean(),
  attendantFirstName: z.string().max(100).optional(),
  attendantLastName: z.string().max(100).optional(),
  attendantGender: genderSchema.optional(),
  attendantDateOfBirth: z.string().optional(),
  attendantNationality: z.string().max(100).optional(),
  attendantPassportNumber: z.string().max(50).optional(),
  attendantPassportExpiry: z.string().optional(),
  attendantPhone: z.string().max(30).optional(),
  attendantRelationToPatient: z.string().max(50).optional(),

  reachOutType: z.enum(["DIRECT", "AGENCY"]),
  agencyId: z.string().optional(),
  assignedToId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type CaseFormValues = z.infer<typeof caseFormSchema>;

const PATIENT_REQUIRED: (keyof CaseFormValues)[] = [
  "patientFirstName",
  "patientLastName",
  "patientGender",
  "patientDateOfBirth",
  "patientNationality",
  "patientPhone",
];

const ATTENDANT_REQUIRED: (keyof CaseFormValues)[] = [
  "attendantFirstName",
  "attendantLastName",
  "attendantGender",
  "attendantDateOfBirth",
  "attendantNationality",
  "attendantPhone",
  "attendantRelationToPatient",
];

/**
 * Manual cross-field validation the flat zod schema can't express (conditional
 * requiredness depending on patient-reuse / attendant-toggle / reach-out-type state).
 * Returns the first error message, or null if valid.
 */
export function validateCaseForm(
  values: CaseFormValues,
  {
    selectedPatientId,
    mode,
  }: { selectedPatientId: string | null; mode?: "create" | "edit" },
): string | null {
  // Patient fields are editable (and thus required) whenever they're actually
  // rendered — see the `(mode === "edit" || !selectedPatient)` guard in
  // case-form.tsx. In edit mode there's no patient-swap UI, so `selectedPatientId`
  // is always truthy there; without this, required-field checks never ran in edit
  // mode and a required patient field could be blanked out and saved silently.
  if (mode === "edit" || !selectedPatientId) {
    for (const field of PATIENT_REQUIRED) {
      if (!values[field]) {
        return `Patient ${String(field).replace("patient", "").toLowerCase()} is required`;
      }
    }
  }

  if (values.hasAttendant) {
    for (const field of ATTENDANT_REQUIRED) {
      if (!values[field]) {
        return `Attendant ${String(field).replace("attendant", "").toLowerCase()} is required`;
      }
    }
  }

  if (values.reachOutType === "AGENCY" && !values.agencyId) {
    return "Agency is required for agency-sourced cases";
  }

  return null;
}

export const inquiryResponseSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
  treatmentCostEstimate: z.string().optional(),
  currency: z.enum(["USD", "INR"]).optional(),
  notes: z.string().max(1000).optional(),
});

export type InquiryResponseFormValues = z.infer<typeof inquiryResponseSchema>;

export const sendInquirySchema = z.object({
  hospitalId: z.string().min(1, "Select a hospital"),
  notes: z.string().max(1000).optional(),
});

export type SendInquiryFormValues = z.infer<typeof sendInquirySchema>;

/**
 * Backend contract: patient fields are bare (`firstName`, `lastName`, ...); attendant
 * fields are sent with an `attendant` prefix (`attendantFirstName`, ...) since both
 * sit flat in the same multipart body — see `Server/Src/Services/Cases/casesService.js`'s
 * `ATTENDANT_FIELD_MAP`. Case creation is multipart/form-data so the passport and
 * case-document file uploads ride along with the scalar fields; `hasAttendant` is sent
 * as the string `"true"`/`"false"` (the backend coerces it).
 */
export function buildCaseCreateFormData(
  values: CaseFormValues,
  selectedPatientId: string | null,
  files: {
    patientPassport: File | null;
    caseDocument: File | null;
    attendantPassport: File | null;
  },
): FormData {
  const fd = new FormData();
  const set = (k: string, v: unknown) => {
    if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
  };

  set("reachOutType", values.reachOutType);
  if (values.reachOutType === "AGENCY") set("agencyId", values.agencyId);
  set("assignedToId", values.assignedToId);
  set("notes", values.notes?.trim());
  fd.append("hasAttendant", String(values.hasAttendant));

  if (selectedPatientId) {
    set("patientId", selectedPatientId);
  } else {
    set("firstName", values.patientFirstName);
    set("lastName", values.patientLastName);
    set("gender", values.patientGender);
    set("dateOfBirth", values.patientDateOfBirth);
    set("nationality", values.patientNationality);
    set("passportNumber", values.patientPassportNumber);
    set("passportExpiry", values.patientPassportExpiry);
    set("phone", values.patientPhone);
    set("email", values.patientEmail?.trim());
    set("address", values.patientAddress?.trim());
  }

  if (values.hasAttendant) {
    set("attendantFirstName", values.attendantFirstName);
    set("attendantLastName", values.attendantLastName);
    set("attendantGender", values.attendantGender);
    set("attendantDateOfBirth", values.attendantDateOfBirth);
    set("attendantNationality", values.attendantNationality);
    set("attendantPassportNumber", values.attendantPassportNumber);
    set("attendantPassportExpiry", values.attendantPassportExpiry);
    set("attendantPhone", values.attendantPhone);
    set("attendantRelationToPatient", values.attendantRelationToPatient);
  }

  if (files.patientPassport) fd.append("patientPassport", files.patientPassport);
  if (files.caseDocument) fd.append("caseDocument", files.caseDocument);
  if (files.attendantPassport) fd.append("attendantPassport", files.attendantPassport);

  return fd;
}

export function buildCaseUpdatePayload(values: CaseFormValues): Record<string, unknown> {
  // Unlike buildCaseCreateFormData, a blanked optional field here must be sent as an
  // explicit "" rather than omitted: `undefined` keys are dropped by
  // JSON.stringify, and the backend's updateCase treats a *missing* key as "leave
  // this field alone," not "clear it." Sending "" is what actually clears
  // notes/email/address/assignedToId back to null server-side.
  const payload: Record<string, unknown> = {
    agencyId: values.reachOutType === "AGENCY" ? values.agencyId : undefined,
    assignedToId: values.assignedToId || "",
    notes: values.notes?.trim() ?? "",
    hasAttendant: values.hasAttendant,
    firstName: values.patientFirstName,
    lastName: values.patientLastName,
    gender: values.patientGender,
    dateOfBirth: values.patientDateOfBirth,
    nationality: values.patientNationality,
    passportNumber: values.patientPassportNumber,
    passportExpiry: values.patientPassportExpiry,
    phone: values.patientPhone,
    email: values.patientEmail?.trim() ?? "",
    address: values.patientAddress?.trim() ?? "",
  };

  if (values.hasAttendant) {
    payload.attendantFirstName = values.attendantFirstName;
    payload.attendantLastName = values.attendantLastName;
    payload.attendantGender = values.attendantGender;
    payload.attendantDateOfBirth = values.attendantDateOfBirth;
    payload.attendantNationality = values.attendantNationality;
    payload.attendantPassportNumber = values.attendantPassportNumber;
    payload.attendantPassportExpiry = values.attendantPassportExpiry;
    payload.attendantPhone = values.attendantPhone;
    payload.attendantRelationToPatient = values.attendantRelationToPatient;
  }

  return payload;
}

export const feePaymentSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  notes: z.string().max(1000).optional(),
});

export type FeePaymentFormValues = z.infer<typeof feePaymentSchema>;

export const embassyVisitSchema = z.object({
  embassyVisitDate: z.string().min(1, "Embassy visit date is required"),
  notes: z.string().max(1000).optional(),
});

export type EmbassyVisitFormValues = z.infer<typeof embassyVisitSchema>;

export const visaOutcomeSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    visaNumber: z.string().max(50).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((v) => v.status !== "APPROVED" || !!v.visaNumber?.trim(), {
    message: "Visa number is required when approved",
    path: ["visaNumber"],
  });

export type VisaOutcomeFormValues = z.infer<typeof visaOutcomeSchema>;

export const refundSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  reason: z.string().min(1, "Reason is required").max(500),
});

export type RefundFormValues = z.infer<typeof refundSchema>;
