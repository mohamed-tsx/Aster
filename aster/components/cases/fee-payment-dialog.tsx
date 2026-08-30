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
import { feePaymentSchema, type FeePaymentFormValues } from "@/lib/validations/case";
import { listAccounts } from "@/services/accounts";
import { getSettings } from "@/services/settings";
import type { Account } from "@/types/account";
import type { ReachOutType } from "@/types/case";

type FeePaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reachOutType: ReachOutType;
  onSubmit: (values: { accountId: string; amount: string; notes?: string }) => Promise<void>;
};

export function FeePaymentDialog({
  open,
  onOpenChange,
  reachOutType,
  onSubmit,
}: FeePaymentDialogProps) {
  const [feeDefaults, setFeeDefaults] = useState<{ direct: string; agency: string }>({
    direct: "400",
    agency: "100",
  });
  const defaultAmount = reachOutType === "AGENCY" ? feeDefaults.agency : feeDefaults.direct;
  const form = useForm<FeePaymentFormValues>({
    defaultValues: { accountId: "", amount: defaultAmount, notes: "" },
  });
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    getSettings()
      .then((s) =>
        setFeeDefaults({
          direct: s.VISA_FEE_DEFAULT_DIRECT ?? "400",
          agency: s.VISA_FEE_DEFAULT_AGENCY ?? "100",
        }),
      )
      .catch(() => {});
  }, []);

  // `defaultAmount` is a dep so a settings fetch that resolves after the dialog is
  // already open still populates the amount. In practice the mount fetch resolves
  // before the dialog opens; the rare re-reset (which also refetches accounts and
  // discards an in-progress entry) is an accepted tradeoff for the prefill.
  useEffect(() => {
    if (open) {
      form.reset({ accountId: "", amount: defaultAmount, notes: "" });
      listAccounts()
        .then(setAccounts)
        .catch(() => setAccounts([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultAmount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record fee payment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = feePaymentSchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(issue.path[0] as keyof FeePaymentFormValues, {
                    message: issue.message,
                  });
                }
                return;
              }
              await onSubmit(parsed.data);
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
            <FormField
              control={form.control}
              name="amount"
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Record payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
