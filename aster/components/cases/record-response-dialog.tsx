"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileField } from "@/components/ui/file-field";
import { useToast } from "@/hooks/use-toast";
import type { HospitalInquiry } from "@/types/case";

type Values = { treatmentCostEstimate: string; currency: "USD" | "INR"; notes: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inquiry: HospitalInquiry | null;
  title: string;
  extraField?: React.ReactNode; // used by change-hospital to add the target select
  buildExtra?: (fd: FormData) => void;
  onSubmit: (payload: FormData) => Promise<void>;
};

export function RecordResponseDialog({ open, onOpenChange, inquiry, title, extraField, buildExtra, onSubmit }: Props) {
  const toast = useToast();
  const form = useForm<Values>({ defaultValues: { treatmentCostEstimate: "", currency: "USD", notes: "" } });
  const [evaluationDoc, setEvaluationDoc] = useState<File | null>(null);
  const [invitationLetter, setInvitationLetter] = useState<File | null>(null);

  // Reset the form + file inputs whenever the dialog transitions to open. Done
  // during render (React's "adjust state on prop change" pattern) rather than in
  // an effect, to avoid a cascading-render lint error.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      form.reset({ treatmentCostEstimate: "", currency: "USD", notes: "" });
      setEvaluationDoc(null);
      setInvitationLetter(null);
    }
  }

  if (!inquiry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              if (!values.treatmentCostEstimate || Number(values.treatmentCostEstimate) <= 0) {
                form.setError("treatmentCostEstimate", { message: "A positive cost estimate is required" });
                return;
              }
              if (!evaluationDoc) { toast.error("Missing file", "Attach the evaluation document"); return; }
              if (!invitationLetter) { toast.error("Missing file", "Attach the invitation letter"); return; }
              const fd = new FormData();
              fd.append("treatmentCostEstimate", values.treatmentCostEstimate);
              fd.append("currency", values.currency);
              if (values.notes.trim()) fd.append("notes", values.notes.trim());
              fd.append("evaluationDoc", evaluationDoc);
              fd.append("invitationLetter", invitationLetter);
              buildExtra?.(fd);
              await onSubmit(fd);
            })}
            className="space-y-4"
          >
            {extraField}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="treatmentCostEstimate" render={({ field }) => (
                <FormItem><FormLabel>Treatment cost estimate</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem><FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="INR">INR</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
            </div>
            <FileField id="evaluationDoc" label="Evaluation document" required value={evaluationDoc} onChange={setEvaluationDoc} />
            <FileField id="invitationLetter" label="Invitation letter" required value={invitationLetter} onChange={setInvitationLetter} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes (optional)</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
