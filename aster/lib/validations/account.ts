import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(150),
  type: z.enum(["BANK", "CASH", "OTHER"]),
  notes: z.string().max(500).optional(),
  openingBalanceUSD: z.string().optional(),
  openingBalanceINR: z.string().optional(),
});

export type AccountFormValues = z.infer<typeof accountSchema>;

/**
 * Converts the form's two fixed currency fields into the flat array the backend
 * expects — only USD/INR exist as currencies (per Currency enum), so a dynamic list
 * UI would be over-engineering for exactly two fixed fields.
 */
export function buildAccountPayload(values: AccountFormValues) {
  const openingBalances: { currency: "USD" | "INR"; amount: string }[] = [];
  if (values.openingBalanceUSD && Number(values.openingBalanceUSD) > 0) {
    openingBalances.push({ currency: "USD", amount: values.openingBalanceUSD });
  }
  if (values.openingBalanceINR && Number(values.openingBalanceINR) > 0) {
    openingBalances.push({ currency: "INR", amount: values.openingBalanceINR });
  }

  return {
    name: values.name,
    type: values.type,
    notes: values.notes?.trim() || undefined,
    openingBalances: openingBalances.length ? openingBalances : undefined,
  };
}
