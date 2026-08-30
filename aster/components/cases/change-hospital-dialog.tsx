"use client";

import { useState } from "react";
import { RecordResponseDialog } from "@/components/cases/record-response-dialog";
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
