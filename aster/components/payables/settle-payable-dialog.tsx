"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  settlePayableSchema,
  type SettlePayableFormValues,
} from "@/lib/validations/payable";
import { settlePayable, getErrorMessage } from "@/services/payables";
import { listAccounts } from "@/services/accounts";
import { useToast } from "@/hooks/use-toast";
import type { Account } from "@/types/account";
import type { Payable } from "@/types/payable";

type SettlePayableDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payable: Payable | null;
  onSuccess: () => void;
};

const DEFAULT_VALUES: SettlePayableFormValues = {
  accountId: "",
  paidOn: "",
};

export function SettlePayableDialog({
  open,
  onOpenChange,
  payable,
  onSuccess,
}: SettlePayableDialogProps) {
  const form = useForm<SettlePayableFormValues>({ defaultValues: DEFAULT_VALUES });
  const toast = useToast();
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

  if (!payable) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle payable</DialogTitle>
          <DialogDescription>
            {payable.payeeName} · {payable.amount} {payable.currency}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = settlePayableSchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(issue.path[0] as keyof SettlePayableFormValues, {
                    message: issue.message,
                  });
                }
                return;
              }
              try {
                await settlePayable(payable.id, parsed.data);
                toast.success("Payable settled");
                onOpenChange(false);
                onSuccess();
              } catch (error) {
                toast.error("Could not settle payable", getErrorMessage(error));
              }
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid from account</FormLabel>
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
              name="paidOn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid on</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
                Settle payable
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
