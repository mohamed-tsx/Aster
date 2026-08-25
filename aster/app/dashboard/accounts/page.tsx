"use client";

import { PageHeader } from "@/components/users/page-header";
import { AccountsTable } from "@/components/accounts/accounts-table";
import { usePermissionGuard } from "@/hooks/use-permission-guard";

export default function AccountsPage() {
  const allowed = usePermissionGuard("MANAGE_ACCOUNTS");
  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Accounts"
        description="Bank and cash accounts money is received into and paid out of."
      />
      <AccountsTable />
    </div>
  );
}
