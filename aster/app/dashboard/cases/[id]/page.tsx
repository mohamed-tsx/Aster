"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/users/page-header";
import { CaseDetailView } from "@/components/cases/case-detail-view";
import { HospitalInquiryPanel } from "@/components/cases/hospital-inquiry-panel";
import { useCaseDetail } from "@/hooks/use-case-detail";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { cancelCase, getErrorMessage } from "@/services/cases";

type PageProps = { params: Promise<{ id: string }> };

export default function CaseDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const { case: kase, loading, refetch } = useCaseDetail(id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelCase(id);
      toast.success("Case cancelled");
      setCancelOpen(false);
      refetch();
    } catch (error) {
      toast.error("Could not cancel case", getErrorMessage(error));
    } finally {
      setCancelling(false);
    }
  };

  if (loading || !kase) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title={kase.caseNumber}
        description={`${kase.patient.firstName} ${kase.patient.lastName}`}
        backHref="/dashboard/cases"
        actions={
          <>
            {hasPermission("UPDATE_CASES") && (
              <Button variant="outline" asChild>
                <Link href={`/dashboard/cases/${id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
            {hasPermission("UPDATE_CASES") && kase.status !== "CANCELLED" && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                Cancel case
              </Button>
            )}
          </>
        }
      />

      <CaseDetailView kase={kase} />
      <HospitalInquiryPanel kase={kase} onChanged={refetch} />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel case {kase.caseNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the case as cancelled. It cannot be reopened from this screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep case</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {cancelling ? "Cancelling..." : "Cancel case"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
