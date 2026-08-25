"use client";

import { useEffect } from "react";
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
import { inquiryResponseSchema, type InquiryResponseFormValues } from "@/lib/validations/case";
import type { HospitalInquiry } from "@/types/case";

type RespondInquiryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inquiry: HospitalInquiry | null;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
};

const EMPTY_VALUES: InquiryResponseFormValues = {
  status: "ACCEPTED",
  treatmentCostEstimate: "",
  currency: "USD",
  notes: "",
};

export function RespondInquiryDialog({
  open,
  onOpenChange,
  inquiry,
  onSubmit,
}: RespondInquiryDialogProps) {
  const form = useForm<InquiryResponseFormValues>({ defaultValues: EMPTY_VALUES });
  const status = form.watch("status");

  useEffect(() => {
    if (open) {
      form.reset(EMPTY_VALUES);
    }
  }, [open, form]);

  if (!inquiry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record {inquiry.hospital.name}&apos;s response</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = inquiryResponseSchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(issue.path[0] as keyof InquiryResponseFormValues, {
                    message: issue.message,
                  });
                }
                return;
              }
              if (parsed.data.treatmentCostEstimate && !parsed.data.currency) {
                form.setError("currency", {
                  message: "Currency is required with a cost estimate",
                });
                return;
              }
              await onSubmit({
                status: parsed.data.status,
                treatmentCostEstimate: parsed.data.treatmentCostEstimate || undefined,
                currency: parsed.data.treatmentCostEstimate
                  ? parsed.data.currency
                  : undefined,
                notes: parsed.data.notes?.trim() || undefined,
              });
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Response</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACCEPTED">Accepted</SelectItem>
                      <SelectItem value="DECLINED">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {status === "ACCEPTED" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="treatmentCostEstimate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Treatment cost estimate</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="INR">INR</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
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
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
