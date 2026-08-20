import { z } from "zod";

export const hospitalSchema = z.object({
  name: z.string().min(1, "Hospital name is required").max(150),
  city: z.string().min(1, "City is required").max(100),
  specialties: z.string().max(300).optional(),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

export type HospitalFormValues = z.infer<typeof hospitalSchema>;
