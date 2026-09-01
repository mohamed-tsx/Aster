"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/users/page-header";
import { ExportMenu } from "@/components/export/export-menu";
import { PreviewTable } from "@/components/export/preview-table";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useToast } from "@/hooks/use-toast";
import { listAccounts, getErrorMessage } from "@/services/accounts";
import { type ExportColumn } from "@/lib/export";
import type { Account } from "@/types/account";

type BalanceRow = { name: string; type: string; currency: string; amount: number };

const COLUMNS: ExportColumn<BalanceRow>[] = [
  { header: "Account", value: (r) => r.name },
  { header: "Type", value: (r) => r.type },
  { header: "Currency", value: (r) => r.currency },
  { header: "Balance", value: (r) => r.amount.toFixed(2) },
];

function toRows(accounts: Account[]): BalanceRow[] {
  const rows: BalanceRow[] = [];
  for (const account of accounts) {
    for (const [currency, amount] of Object.entries(account.balances)) {
      if (amount === 0) continue;
      rows.push({ name: account.name, type: account.type, currency, amount });
    }
  }
  return rows;
}

export default function FinanceSummaryReportPage() {
  const allowed = usePermissionGuard("VIEW_FINANCE");
  const toast = useToast();
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      setRows(toRows(await listAccounts()));
    } catch (error) {
      toast.error("Failed to load account balances", getErrorMessage(error));
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Finance summary report"
        description="Current balance of every account, ready to preview and export."
        actions={
          <ExportMenu
            filename="finance-summary"
            pdfTitle="Finance Summary"
            columns={COLUMNS}
            fetchRows={async () => toRows(await listAccounts())}
          />
        }
      />

      <PreviewTable
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        rowKey={(r) => `${r.name}-${r.currency}`}
        emptyMessage="No non-zero account balances."
      />
    </div>
  );
}
