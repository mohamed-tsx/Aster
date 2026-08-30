"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { embassyVisitSchema, type EmbassyVisitFormValues } from "@/lib/validations/case";
import { listAccounts } from "@/services/accounts";
import { getSettings } from "@/services/settings";
import type { Account } from "@/types/account";

type EmbassyVisitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    embassyVisitDate: string;
    notes?: string;
    partnerCommission?: { amount: string; accountId: string };
  }) => Promise<void>;
};

export function EmbassyVisitDialog({ open, onOpenChange, onSubmit }: EmbassyVisitDialogProps) {
  const [defaultCommission, setDefaultCommission] = useState("0");
  const form = useForm<EmbassyVisitFormValues>({
    defaultValues: {
      embassyVisitDate: "",
      notes: "",
      partnerCommissionAmount: defaultCommission,
      partnerCommissionAccountId: "",
    },
  });
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    getSettings()
      .then((s) => setDefaultCommission(s.EMBASSY_COMMISSION_DEFAULT ?? "0"))
      .catch(() => {});
  }, []);

  // `defaultCommission` is a dep so a settings fetch that resolves after the dialog
  // is already open still prefills the amount (mirrors fee-payment-dialog).
  useEffect(() => {
    if (open) {
      form.reset({
        embassyVisitDate: "",
        notes: "",
        partnerCommissionAmount: defaultCommission,
        partnerCommissionAccountId: "",
      });
      listAccounts()
        .then(setAccounts)
        .catch(() => setAccounts([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCommission]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record embassy visit</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = embassyVisitSchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(issue.path[0] as keyof EmbassyVisitFormValues, {
                    message: issue.message,
                  });
                }
                return;
              }
              const amt = parsed.data.partnerCommissionAmount;
              if (amt && Number(amt) > 0 && !parsed.data.partnerCommissionAccountId) {
                form.setError("partnerCommissionAccountId", {
                  message: "Select an account for the commission",
                });
                return;
              }
              await onSubmit({
                embassyVisitDate: parsed.data.embassyVisitDate,
                notes: parsed.data.notes?.trim() || undefined,
                partnerCommission:
                  amt && Number(amt) > 0
                    ? { amount: amt, accountId: parsed.data.partnerCommissionAccountId ?? "" }
                    : undefined,
              });
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="embassyVisitDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Embassy visit date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-4 rounded-md border p-3">
              <p className="text-sm font-medium">Partner commission (optional)</p>
              <FormField
                control={form.control}
                name="partnerCommissionAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="partnerCommissionAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
