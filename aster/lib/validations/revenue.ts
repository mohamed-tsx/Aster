import { z } from "zod";

export const revenueSchema = z.object({
  category: z.enum(["HOSPITAL_REFERRAL_COMMISSION", "OTHER_INCOME"]),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  currency: z.enum(["USD", "INR"]),
  accountId: z.string().min(1, "Select an account"),
  receivedOn: z.string().min(1, "Date received is required"),
  caseId: z.string().optional(),
  description: z.string().max(1000).optional(),
});

export type RevenueFormValues = z.infer<typeof revenueSchema>;
