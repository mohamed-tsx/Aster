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
import { listHospitals } from "@/services/hospitals";
import { sendInquirySchema, type SendInquiryFormValues } from "@/lib/validations/case";
import type { Hospital } from "@/types/hospital";

type SendInquiryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { hospitalId: string; notes?: string }) => Promise<void>;
};

const EMPTY_VALUES: SendInquiryFormValues = { hospitalId: "", notes: "" };

export function SendInquiryDialog({
  open,
  onOpenChange,
  onSubmit,
}: SendInquiryDialogProps) {
  const form = useForm<SendInquiryFormValues>({ defaultValues: EMPTY_VALUES });
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  useEffect(() => {
    if (open) {
      form.reset(EMPTY_VALUES);
      listHospitals()
        .then(setHospitals)
        .catch(() => setHospitals([]));
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to hospital</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = sendInquirySchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(issue.path[0] as keyof SendInquiryFormValues, {
                    message: issue.message,
                  });
                }
                return;
              }
              await onSubmit({
                hospitalId: parsed.data.hospitalId,
                notes: parsed.data.notes?.trim() || undefined,
              });
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="hospitalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hospital</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select hospital" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hospitals.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name} — {h.city}
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
                Send
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
