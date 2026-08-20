"use client";

import { PageHeader } from "@/components/users/page-header";
import { HospitalsTable } from "@/components/hospitals/hospitals-table";
import { usePermissionGuard } from "@/hooks/use-permission-guard";

export default function HospitalsPage() {
  const allowed = usePermissionGuard("MANAGE_HOSPITALS");
  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Hospitals"
        description="Manage the partner hospitals cases can be matched to."
      />
      <HospitalsTable />
    </div>
  );
}
