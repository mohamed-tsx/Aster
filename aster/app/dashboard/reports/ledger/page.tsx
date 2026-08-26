"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useToast } from "@/hooks/use-toast";
import { listAccounts, listAccountTransactions, getErrorMessage } from "@/services/accounts";
import { exportToExcel, fetchAllPages, type ExportColumn } from "@/lib/export";
import type { Account, AccountTransaction } from "@/types/account";

const COLUMNS: ExportColumn<AccountTransaction>[] = [
  { header: "Type", value: (t) => t.type },
  { header: "Amount", value: (t) => t.amount },
  { header: "Currency", value: (t) => t.currency },
  {
    header: "Case",
    value: (t) =>
      t.payment?.visaApplication.case.caseNumber ??
      t.expense?.case?.caseNumber ??
      t.refund?.payment.visaApplication.case.caseNumber ??
      "",
  },
  { header: "Notes", value: (t) => t.notes ?? "" },
  { header: "By", value: (t) => `${t.createdBy.firstName} ${t.createdBy.lastName}` },
  { header: "Date", value: (t) => new Date(t.occurredAt).toISOString().slice(0, 10) },
];

export default function AccountLedgerReportPage() {
  const allowed = usePermissionGuard("MANAGE_ACCOUNTS");
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch((error) => toast.error("Failed to load accounts", getErrorMessage(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!allowed) return null;

  const handleExport = async () => {
    if (!accountId) return;
    setExporting(true);
    try {
      const transactions = await fetchAllPages((page, limit) =>
        listAccountTransactions(accountId, { page, limit }).then((result) => ({
          items: result.transactions,
          total: result.total,
        })),
      );

      if (transactions.length === 0) {
        toast.info("Nothing to export", "This account has no transactions.");
        return;
      }

      const account = accounts.find((a) => a.id === accountId);
      exportToExcel(
        `ledger-${account?.name ?? "account"}-${new Date().toISOString().slice(0, 10)}`,
        transactions,
        COLUMNS,
      );
      toast.success(`Exported ${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error("Export failed", getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Account ledger report"
        description="Export an account's full transaction history to Excel."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Select an account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleExport} disabled={!accountId || exporting}>
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export to Excel
        </Button>
      </div>
    </div>
  );
}
