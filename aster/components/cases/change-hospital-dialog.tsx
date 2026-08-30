"use client";

import { useState } from "react";
import { RecordResponseDialog } from "@/components/cases/record-response-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Case, HospitalInquiry } from "@/types/case";

export function ChangeHospitalDialog({
  open, onOpenChange, kase, currentChosen, onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kase: Case;
  currentChosen: HospitalInquiry;
  onSubmit: (payload: FormData) => Promise<void>;
}) {
  const options = kase.inquiries.filter((i) => ["PENDING", "NOT_SELECTED"].includes(i.status));
  const [target, setTarget] = useState<string>(options[0]?.id ?? "");

  // This component stays mounted between openings, so `target` would otherwise
  // keep the id picked on a previous change — stale once that inquiry became the
  // chosen one. Re-seed on each open, using React's "adjust state on prop change"
  // pattern (during render, not in an effect) to match record-response-dialog.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTarget(options[0]?.id ?? "");
  }

  // The parent mounts this whenever a chosen inquiry exists and no fee is paid,
  // which does not guarantee there is another inquiry to switch to.
  if (options.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change chosen hospital</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            No other hospital inquiry to switch to. Send an inquiry to another hospital first.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <RecordResponseDialog
      open={open}
      onOpenChange={onOpenChange}
      inquiry={currentChosen}
      title="Change chosen hospital"
      onSubmit={onSubmit}
      buildExtra={(fd) => fd.append("newInquiryId", target)}
      extraField={
        <div className="space-y-2">
          <Label>New hospital</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Pick an inquiry" /></SelectTrigger>
            <SelectContent>
              {options.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.hospital.name} — {i.hospital.country}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    />
  );
}
