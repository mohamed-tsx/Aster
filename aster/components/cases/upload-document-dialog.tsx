"use client";

import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DocumentType } from "@/types/document";

type UploadDocumentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (file: File, type: DocumentType) => Promise<void>;
};

const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "PATIENT_PASSPORT", label: "Patient passport" },
  { value: "ATTENDANT_PASSPORT", label: "Attendant passport" },
  { value: "INVITATION_LETTER", label: "Invitation letter" },
  { value: "VISA_COPY", label: "Visa copy" },
  { value: "OTHER", label: "Other" },
];

export function UploadDocumentDialog({ open, onOpenChange, onSubmit }: UploadDocumentDialogProps) {
  const [type, setType] = useState<DocumentType>("OTHER");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType("OTHER");
      setFile(null);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!file) {
      setError("Select a file to upload");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(file, type);
    } catch {
      // Error toast is handled by the caller; keep the dialog open on failure.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Document type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DocumentType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>File</Label>
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
