import { z } from "zod";

export const agencySchema = z.object({
  name: z.string().min(1, "Agency name is required").max(150),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().max(300).optional(),
});

export type AgencyFormValues = z.infer<typeof agencySchema>;
