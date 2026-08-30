"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendInquiryDialog } from "@/components/cases/send-inquiry-dialog";
import { RecordResponseDialog } from "@/components/cases/record-response-dialog";
import { ChangeHospitalDialog } from "@/components/cases/change-hospital-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import {
  sendInquiry,
  recordChosenResponse,
  changeChosenHospital,
  declineInquiry,
  getErrorMessage,
} from "@/services/cases";
import { getImageUrl } from "@/utils/imageUtils";
import type { Case, HospitalInquiry } from "@/types/case";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

const INQUIRY_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  ACCEPTED: "default",
  DECLINED: "destructive",
  NOT_SELECTED: "outline",
};

const INQUIRY_STATUS_LABEL: Record<string, string> = {
  NOT_SELECTED: "Not selected",
};

/** Mirrors SENDABLE_CASE_STATUSES in the backend's casesService.js. */
const SENDABLE_CASE_STATUSES = ["NEW", "HOSPITAL_MATCHING", "HOSPITAL_DECLINED"];

type HospitalInquiryPanelProps = {
  kase: Case;
  onChanged: () => void;
};

export function HospitalInquiryPanel({ kase, onChanged }: HospitalInquiryPanelProps) {
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [sendOpen, setSendOpen] = useState(false);
  const [recordingInquiry, setRecordingInquiry] = useState<HospitalInquiry | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);

  const chosen = kase.inquiries.find((i) => i.isChosen) ?? null;
  const feePaid = kase.visaApplications.some((v) => v.payment);
  // Gate on the case status the backend actually accepts, not on `!chosen`:
  // a legacy case with a backfilled chosen inquiry sits outside the sendable set
  // anyway, and CANCELLED is already excluded by not being in it.
  const canSend =
    hasPermission("UPDATE_CASES") && SENDABLE_CASE_STATUSES.includes(kase.status);

  const handleSend = async (values: { hospitalId: string; notes?: string }) => {
    try {
      await sendInquiry(kase.id, values);
      toast.success("Inquiry sent");
      setSendOpen(false);
      onChanged();
    } catch (error) {
      toast.error("Could not send inquiry", getErrorMessage(error));
      throw error;
    }
  };

  const handleRecord = async (payload: FormData) => {
    if (!recordingInquiry) return;
    try {
      await recordChosenResponse(kase.id, recordingInquiry.id, payload);
      toast.success("Response recorded");
      setRecordingInquiry(null);
      onChanged();
    } catch (e) {
      toast.error("Could not record response", getErrorMessage(e));
      throw e;
    }
  };

  const handleChange = async (payload: FormData) => {
    try {
      await changeChosenHospital(kase.id, payload);
      toast.success("Chosen hospital changed");
      setChangeOpen(false);
      onChanged();
    } catch (e) {
      toast.error("Could not change hospital", getErrorMessage(e));
      throw e;
    }
  };

  const handleDecline = async (inquiry: HospitalInquiry) => {
    try {
      await declineInquiry(kase.id, inquiry.id);
      toast.success("Inquiry declined");
      onChanged();
    } catch (e) {
      toast.error("Could not decline", getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Hospital matching</CardTitle>
        {canSend && (
          <Button size="sm" onClick={() => setSendOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Send to hospital
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {kase.inquiries.length === 0 && (
          <p className="text-sm text-muted-foreground">No inquiries sent yet.</p>
        )}
        {kase.inquiries.map((inquiry) => (
          <div
            key={inquiry.id}
            className="flex items-start justify-between rounded-md border p-3"
          >
            <div>
              <p className="text-sm font-medium">
                {inquiry.hospital.name} — {inquiry.hospital.city}, {inquiry.hospital.country}
              </p>
              <p className="text-xs text-muted-foreground">
                Sent {formatDate(inquiry.sentAt)}
                {inquiry.respondedAt && ` · Responded ${formatDate(inquiry.respondedAt)}`}
              </p>
              {inquiry.treatmentCostEstimate && (
                <p className="text-xs text-muted-foreground">
                  Estimate: {inquiry.treatmentCostEstimate} {inquiry.currency}
                </p>
              )}
              {inquiry.notes && <p className="mt-1 text-xs">{inquiry.notes}</p>}
              {inquiry.isChosen && inquiry.documents.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3">
                  {inquiry.documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={getImageUrl(doc.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline"
                    >
                      {doc.fileName}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {inquiry.isChosen && <Badge>Chosen</Badge>}
                <Badge variant={INQUIRY_STATUS_VARIANT[inquiry.status]}>
                  {INQUIRY_STATUS_LABEL[inquiry.status] ?? inquiry.status}
                </Badge>
              </div>
              {inquiry.isChosen &&
                !feePaid &&
                hasPermission("RECORD_HOSPITAL_RESPONSE") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setChangeOpen(true)}
                  >
                    Change hospital
                  </Button>
                )}
              {inquiry.status === "PENDING" && !chosen && (
                <div className="flex items-center gap-2">
                  {hasPermission("RECORD_HOSPITAL_RESPONSE") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRecordingInquiry(inquiry)}
                    >
                      Record chosen response
                    </Button>
                  )}
                  {hasPermission("UPDATE_CASES") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDecline(inquiry)}
                    >
                      Mark declined
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <SendInquiryDialog open={sendOpen} onOpenChange={setSendOpen} onSubmit={handleSend} />
      <RecordResponseDialog
        open={!!recordingInquiry}
        onOpenChange={(open) => !open && setRecordingInquiry(null)}
        inquiry={recordingInquiry}
        title="Record chosen hospital response"
        onSubmit={handleRecord}
      />
      {chosen && (
        <ChangeHospitalDialog
          open={changeOpen}
          onOpenChange={setChangeOpen}
          kase={kase}
          currentChosen={chosen}
          onSubmit={handleChange}
        />
      )}
    </Card>
  );
}
