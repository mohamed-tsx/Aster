import { z } from "zod";

export const payableSchema = z.object({
  payeeName: z.string().min(1, "Payee name is required").max(150),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  currency: z.enum(["USD", "INR"]),
  reason: z.string().min(1, "Reason is required").max(1000),
  raisedOn: z.string().min(1, "Raised date is required"),
  caseId: z.string().optional(),
});

export type PayableFormValues = z.infer<typeof payableSchema>;

export const settlePayableSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  paidOn: z.string().min(1, "Payment date is required"),
});

export type SettlePayableFormValues = z.infer<typeof settlePayableSchema>;
