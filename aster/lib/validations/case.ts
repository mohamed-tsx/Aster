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
  "patientPassportNumber",
  "patientPassportExpiry",
  "patientPhone",
];

const ATTENDANT_REQUIRED: (keyof CaseFormValues)[] = [
  "attendantFirstName",
  "attendantLastName",
  "attendantGender",
  "attendantDateOfBirth",
  "attendantNationality",
  "attendantPassportNumber",
  "attendantPassportExpiry",
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
  { selectedPatientId }: { selectedPatientId: string | null },
): string | null {
  if (!selectedPatientId) {
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
