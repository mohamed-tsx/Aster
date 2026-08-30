export type Gender = "MALE" | "FEMALE" | "OTHER";

export type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string | null;
  passportExpiry: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};

// The shape returned by the patient search endpoint (Server's searchPatients),
// which selects only the fields the search-and-pick UI actually renders — not the
// full Patient record (PHI like DOB/phone/email/address/passport-expiry is never
// sent for a search-by-passport-fragment query).
export type PatientSummary = Pick<Patient, "id" | "firstName" | "lastName"> & {
  passportNumber: string | null;
  hasPassportOnFile: boolean;
};
