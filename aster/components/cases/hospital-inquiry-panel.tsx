"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendInquiryDialog } from "@/components/cases/send-inquiry-dialog";
import { RespondInquiryDialog } from "@/components/cases/respond-inquiry-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { sendInquiry, respondToInquiry, getErrorMessage } from "@/services/cases";
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

const INQUIRY_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  PENDING: "secondary",
  ACCEPTED: "default",
  DECLINED: "destructive",
};

type HospitalInquiryPanelProps = {
  kase: Case;
  onChanged: () => void;
};

export function HospitalInquiryPanel({ kase, onChanged }: HospitalInquiryPanelProps) {
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [sendOpen, setSendOpen] = useState(false);
  const [respondingInquiry, setRespondingInquiry] = useState<HospitalInquiry | null>(null);

  const hasPending = kase.inquiries.some((i) => i.status === "PENDING");
  const canSend = hasPermission("UPDATE_CASES") && !hasPending && kase.status !== "CANCELLED";

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

  const handleRespond = async (values: Record<string, unknown>) => {
    if (!respondingInquiry) return;
    try {
      await respondToInquiry(kase.id, respondingInquiry.id, values);
      toast.success("Response recorded");
      setRespondingInquiry(null);
      onChanged();
    } catch (error) {
      toast.error("Could not record response", getErrorMessage(error));
      throw error;
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
                {inquiry.hospital.name} — {inquiry.hospital.city}
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
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={INQUIRY_STATUS_VARIANT[inquiry.status]}>
                {inquiry.status}
              </Badge>
              {inquiry.status === "PENDING" &&
                hasPermission("UPDATE_CASES") &&
                kase.status !== "CANCELLED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRespondingInquiry(inquiry)}
                >
                  Record response
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <SendInquiryDialog open={sendOpen} onOpenChange={setSendOpen} onSubmit={handleSend} />
      <RespondInquiryDialog
        open={!!respondingInquiry}
        onOpenChange={(open) => !open && setRespondingInquiry(null)}
        inquiry={respondingInquiry}
        onSubmit={handleRespond}
      />
    </Card>
  );
}
