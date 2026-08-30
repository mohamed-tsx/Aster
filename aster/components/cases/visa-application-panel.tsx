"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeePaymentDialog } from "@/components/cases/fee-payment-dialog";
import { EmbassyVisitDialog } from "@/components/cases/embassy-visit-dialog";
import { VisaOutcomeDialog } from "@/components/cases/visa-outcome-dialog";
import { RefundDialog } from "@/components/cases/refund-dialog";
import { UploadDocumentDialog } from "@/components/cases/upload-document-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import {
  recordFeePayment,
  recordFeePaymentByTraveler,
  markEmbassyVisited,
  recordVisaOutcome,
  issueRefund,
  getErrorMessage,
} from "@/services/cases";
import { uploadDocument } from "@/services/documents";
import type { RefundFormValues } from "@/lib/validations/case";
import type { Case } from "@/types/case";
import type { VisaApplication, VisaApplicationStatus } from "@/types/visa";

function refundableBalance(visaApplication: VisaApplication): number {
  if (!visaApplication.payment) return 0;
  const alreadyRefunded = visaApplication.payment.refunds.reduce(
    (sum, r) => sum + Number(r.amount),
    0,
  );
  return Number(visaApplication.payment.amount) - alreadyRefunded;
}

const STATUS_VARIANT: Record<VisaApplicationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  FEE_PAID: "outline",
  EMBASSY_VISITED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type VisaApplicationPanelProps = {
  kase: Case;
  onChanged: () => void;
};

export function VisaApplicationPanel({ kase, onChanged }: VisaApplicationPanelProps) {
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [feePaymentTarget, setFeePaymentTarget] = useState<VisaApplication | null>(null);
  const [agencyFeeTarget, setAgencyFeeTarget] = useState<"PATIENT" | "ATTENDANT" | null>(null);
  const [embassyVisitTarget, setEmbassyVisitTarget] = useState<VisaApplication | null>(null);
  const [outcomeTarget, setOutcomeTarget] = useState<VisaApplication | null>(null);
  const [refundTarget, setRefundTarget] = useState<VisaApplication | null>(null);
  const [attendantPassportUploadOpen, setAttendantPassportUploadOpen] = useState(false);

  const isAgency = kase.reachOutType === "AGENCY";
  const showAgencyTracker =
    isAgency && ["HOSPITAL_ACCEPTED", "VISA_PROCESSING"].includes(kase.status);
  const attendantPassportMissing =
    !!kase.attendant &&
    !isAgency &&
    !kase.documents.some((d) => d.type === "ATTENDANT_PASSPORT");

  if (kase.visaApplications.length === 0 && !showAgencyTracker) return null;

  const missingAgencyTravelers: ("PATIENT" | "ATTENDANT")[] = showAgencyTracker
    ? (kase.attendant
        ? (["PATIENT", "ATTENDANT"] as const)
        : (["PATIENT"] as const)
      ).filter((t) => !kase.visaApplications.some((v) => v.travelerType === t))
    : [];

  const handleFeePayment = async (values: { accountId: string; amount: string; notes?: string }) => {
    try {
      if (agencyFeeTarget) {
        await recordFeePaymentByTraveler(kase.id, { travelerType: agencyFeeTarget, ...values });
      } else if (feePaymentTarget) {
        await recordFeePayment(kase.id, feePaymentTarget.id, values);
      } else {
        return;
      }
      toast.success("Fee payment recorded");
      setFeePaymentTarget(null);
      setAgencyFeeTarget(null);
      onChanged();
    } catch (error) {
      toast.error("Could not record payment", getErrorMessage(error));
      throw error;
    }
  };

  const handleEmbassyVisit = async (values: {
    embassyVisitDate: string;
    notes?: string;
    partnerCommission?: { amount: string; accountId: string };
  }) => {
    if (!embassyVisitTarget) return;
    try {
      await markEmbassyVisited(kase.id, embassyVisitTarget.id, values);
      toast.success("Embassy visit recorded");
      setEmbassyVisitTarget(null);
      onChanged();
    } catch (error) {
      toast.error("Could not record embassy visit", getErrorMessage(error));
      throw error;
    }
  };

  const handleOutcome = async (values: { status: "APPROVED" | "REJECTED"; visaNumber?: string; notes?: string }) => {
    if (!outcomeTarget) return;
    try {
      await recordVisaOutcome(kase.id, outcomeTarget.id, values);
      toast.success("Visa outcome recorded");
      setOutcomeTarget(null);
      onChanged();
    } catch (error) {
      toast.error("Could not record outcome", getErrorMessage(error));
      throw error;
    }
  };

  const handleRefund = async (values: RefundFormValues) => {
    if (!refundTarget) return;
    try {
      await issueRefund(kase.id, refundTarget.id, values);
      toast.success("Refund issued");
      setRefundTarget(null);
      onChanged();
    } catch (error) {
      toast.error("Could not issue refund", getErrorMessage(error));
      throw error;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Visa processing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {kase.visaApplications.map((visaApplication) => (
          <div key={visaApplication.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {visaApplication.travelerType === "PATIENT" ? "Patient" : "Attendant"}
              </p>
              <Badge variant={STATUS_VARIANT[visaApplication.status]}>
                {visaApplication.status.replace(/_/g, " ")}
              </Badge>
            </div>
            {visaApplication.payment && (
              <p className="mt-1 text-xs text-muted-foreground">
                Fee paid: {visaApplication.payment.amount} {visaApplication.payment.currency}
              </p>
            )}
            {visaApplication.payment?.refunds.map((refund) => (
              <p key={refund.id} className="text-xs text-muted-foreground">
                Refunded: {refund.amount} {visaApplication.payment!.currency} — {refund.reason}
              </p>
            ))}
            {visaApplication.embassyVisitDate && (
              <p className="text-xs text-muted-foreground">
                Embassy visited: {formatDate(visaApplication.embassyVisitDate)}
              </p>
            )}
            {visaApplication.visaNumber && (
              <p className="text-xs text-muted-foreground">
                Visa number: {visaApplication.visaNumber}
              </p>
            )}
            {visaApplication.notes && (
              <p className="mt-1 text-xs">{visaApplication.notes}</p>
            )}

            {kase.status !== "CANCELLED" &&
              visaApplication.status === "PENDING" &&
              hasPermission("MANAGE_FINANCE") &&
              (attendantPassportMissing ? (
                <div className="mt-2 space-y-2">
                  <Button size="sm" disabled>
                    Record fee payment
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Upload the attendant&apos;s passport before recording the visa fee.
                  </p>
                  {hasPermission("UPDATE_CASES") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAttendantPassportUploadOpen(true)}
                    >
                      Upload attendant passport
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => setFeePaymentTarget(visaApplication)}
                >
                  Record fee payment
                </Button>
              ))}
            {kase.status !== "CANCELLED" &&
              visaApplication.status === "FEE_PAID" &&
              hasPermission("UPDATE_CASES") && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setEmbassyVisitTarget(visaApplication)}
              >
                Mark embassy visited
              </Button>
            )}
            {kase.status !== "CANCELLED" &&
              visaApplication.status === "EMBASSY_VISITED" &&
              hasPermission("UPDATE_CASES") && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setOutcomeTarget(visaApplication)}
              >
                Record outcome
              </Button>
            )}
            {refundableBalance(visaApplication) > 0 && hasPermission("ISSUE_REFUNDS") && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setRefundTarget(visaApplication)}
              >
                Issue refund
              </Button>
            )}
          </div>
        ))}

        {missingAgencyTravelers.map((traveler) => (
          <div key={traveler} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {traveler === "PATIENT" ? "Patient" : "Attendant"}
              </p>
              <Badge variant="secondary">NOT STARTED</Badge>
            </div>
            {kase.status !== "CANCELLED" && hasPermission("MANAGE_FINANCE") && (
              <Button
                size="sm"
                className="mt-2"
                onClick={() => setAgencyFeeTarget(traveler)}
              >
                Record fee payment
              </Button>
            )}
          </div>
        ))}
      </CardContent>

      <FeePaymentDialog
        open={!!feePaymentTarget || !!agencyFeeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setFeePaymentTarget(null);
            setAgencyFeeTarget(null);
          }
        }}
        reachOutType={kase.reachOutType}
        onSubmit={handleFeePayment}
      />
      <UploadDocumentDialog
        open={attendantPassportUploadOpen}
        onOpenChange={setAttendantPassportUploadOpen}
        lockedType="ATTENDANT_PASSPORT"
        onSubmit={async (file) => {
          try {
            await uploadDocument(kase.id, file, "ATTENDANT_PASSPORT");
            toast.success("Attendant passport uploaded");
            setAttendantPassportUploadOpen(false);
            onChanged();
          } catch (error) {
            toast.error("Upload failed", getErrorMessage(error));
            throw error;
          }
        }}
      />
      <EmbassyVisitDialog
        open={!!embassyVisitTarget}
        onOpenChange={(open) => !open && setEmbassyVisitTarget(null)}
        onSubmit={handleEmbassyVisit}
      />
      <VisaOutcomeDialog
        open={!!outcomeTarget}
        onOpenChange={(open) => !open && setOutcomeTarget(null)}
        onSubmit={handleOutcome}
      />
      <RefundDialog
        open={!!refundTarget}
        onOpenChange={(open) => !open && setRefundTarget(null)}
        refundableAmount={refundTarget ? refundableBalance(refundTarget) : 0}
        onSubmit={handleRefund}
      />
    </Card>
  );
}
