import { z } from "zod";

export const loanSchema = z.object({
  lenderName: z.string().min(1, "Lender name is required").max(150),
  principal: z
    .string()
    .min(1, "Principal is required")
    .refine((v) => Number(v) > 0, "Principal must be greater than 0"),
  currency: z.enum(["USD", "INR"]),
  interestRatePct: z
    .string()
    .min(1, "Interest rate is required")
    .refine((v) => Number(v) >= 0, "Interest rate cannot be negative"),
  interestMethod: z.enum(["SIMPLE", "COMPOUND_MONTHLY"]),
  disbursedOn: z.string().min(1, "Disbursement date is required"),
  termMonths: z
    .string()
    .min(1, "Term is required")
    .refine(
      (v) => Number.isInteger(Number(v)) && Number(v) > 0,
      "Term must be a positive whole number of months",
    ),
  accountId: z.string().min(1, "Select an account"),
  notes: z.string().max(1000).optional(),
});

export type LoanFormValues = z.infer<typeof loanSchema>;

export const repaymentSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  paidOn: z.string().min(1, "Payment date is required"),
  accountId: z.string().min(1, "Select an account"),
});

export type RepaymentFormValues = z.infer<typeof repaymentSchema>;
