"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/users/page-header";
import { CaseForm } from "@/components/cases/case-form";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { createCase, getErrorMessage } from "@/services/cases";

export default function NewCasePage() {
  const router = useRouter();
  const allowed = usePermissionGuard("CREATE_CASES");
  if (!allowed) return null;

  const handleCreate = async (payload: Record<string, unknown>) => {
    try {
      const kase = await createCase(payload);
      toast.success("Case created.");
      router.push(`/dashboard/cases/${kase.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not create case"));
      throw error;
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="New case"
        description="Register a new patient referral case."
        backHref="/dashboard/cases"
      />
      <CaseForm mode="create" onSubmit={handleCreate} />
    </div>
  );
}
