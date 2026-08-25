"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/users/page-header";
import { CaseForm } from "@/components/cases/case-form";
import { useCaseDetail } from "@/hooks/use-case-detail";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { updateCase, getErrorMessage } from "@/services/cases";

type PageProps = { params: Promise<{ id: string }> };

export default function EditCasePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const allowed = usePermissionGuard("UPDATE_CASES");
  const { case: kase, loading } = useCaseDetail(id);

  if (!allowed) return null;

  const handleUpdate = async (payload: Record<string, unknown>) => {
    try {
      await updateCase(id, payload);
      toast.success("Case updated.");
      router.push(`/dashboard/cases/${id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update case"));
      throw error;
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
        title={`Edit ${kase.caseNumber}`}
        description="Update case, patient, and attendant details."
        backHref={`/dashboard/cases/${id}`}
      />
      <CaseForm mode="edit" initialCase={kase} onSubmit={handleUpdate} />
    </div>
  );
}
