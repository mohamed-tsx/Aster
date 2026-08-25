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
import { embassyVisitSchema, type EmbassyVisitFormValues } from "@/lib/validations/case";

type EmbassyVisitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { embassyVisitDate: string; notes?: string }) => Promise<void>;
};

export function EmbassyVisitDialog({ open, onOpenChange, onSubmit }: EmbassyVisitDialogProps) {
  const form = useForm<EmbassyVisitFormValues>({
    defaultValues: { embassyVisitDate: "", notes: "" },
  });

  useEffect(() => {
    if (open) form.reset({ embassyVisitDate: "", notes: "" });
  }, [open, form]);

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
              await onSubmit(parsed.data);
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
