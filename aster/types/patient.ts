export type Gender = "MALE" | "FEMALE" | "OTHER";

export type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  phone: string;
  email: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};
