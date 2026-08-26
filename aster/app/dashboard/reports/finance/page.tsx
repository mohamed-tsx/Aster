"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useToast } from "@/hooks/use-toast";
import { listAccounts, getErrorMessage } from "@/services/accounts";
import { exportToPdf, type ExportColumn } from "@/lib/export";
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
  const [exporting, setExporting] = useState(false);

  if (!allowed) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const accounts = await listAccounts();
      const rows = toRows(accounts);

      if (rows.length === 0) {
        toast.info("Nothing to export", "No non-zero account balances.");
        return;
      }

      exportToPdf(
        `finance-summary-${new Date().toISOString().slice(0, 10)}`,
        "Finance Summary",
        rows,
        COLUMNS,
      );
      toast.success("Finance summary exported");
    } catch (error) {
      toast.error("Export failed", getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Finance summary report"
        description="Export a PDF of current account balances."
        actions={
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export to PDF
          </Button>
        }
      />
    </div>
  );
}
