import { z } from "zod";

export const expenseSchema = z.object({
  category: z.string().min(1, "Category is required").max(150),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  currency: z.enum(["USD", "INR"]),
  accountId: z.string().min(1, "Select an account"),
  notes: z.string().max(1000).optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
