"use client";

import { PageHeader } from "@/components/users/page-header";
import { AgenciesTable } from "@/components/agencies/agencies-table";
import { usePermissionGuard } from "@/hooks/use-permission-guard";

export default function AgenciesPage() {
  const allowed = usePermissionGuard("MANAGE_AGENCIES");
  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Agencies"
        description="Manage the referral agencies that bring in agency-sourced cases."
      />
      <AgenciesTable />
    </div>
  );
}
