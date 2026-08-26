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
import { refundSchema, type RefundFormValues } from "@/lib/validations/case";
import { listAccounts } from "@/services/accounts";
import type { Account } from "@/types/account";

type RefundDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Payment amount minus any refunds already issued against it. */
  refundableAmount: number;
  onSubmit: (values: RefundFormValues) => Promise<void>;
};

const DEFAULT_VALUES: RefundFormValues = { accountId: "", amount: "", reason: "" };

export function RefundDialog({
  open,
  onOpenChange,
  refundableAmount,
  onSubmit,
}: RefundDialogProps) {
  const form = useForm<RefundFormValues>({ defaultValues: DEFAULT_VALUES });
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (open) {
      form.reset(DEFAULT_VALUES);
      listAccounts()
        .then(setAccounts)
        .catch(() => setAccounts([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue refund</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Refundable balance: {refundableAmount.toFixed(2)}
        </p>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = refundSchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(issue.path[0] as keyof RefundFormValues, {
                    message: issue.message,
                  });
                }
                return;
              }
              if (Number(parsed.data.amount) > refundableAmount) {
                form.setError("amount", {
                  message: `Amount cannot exceed the refundable balance of ${refundableAmount.toFixed(2)}`,
                });
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
                  <FormLabel>Refund from account</FormLabel>
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
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
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
                Issue refund
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
