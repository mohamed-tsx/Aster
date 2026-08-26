"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import {
  AccountTransactionsTable,
  TYPE_LABEL,
  CREDIT_TYPES,
  describe,
} from "@/components/accounts/account-transactions-table";
import { ListPagination } from "@/components/pagination/list-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useToast } from "@/hooks/use-toast";
import { listAllAccountTransactions, getErrorMessage } from "@/services/accounts";
import { exportToExcel, exportToPdf, fetchAllPages, type ExportColumn } from "@/lib/export";
import type { AccountTransaction } from "@/types/account";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(iso));
}

const COLUMNS: ExportColumn<AccountTransaction>[] = [
  { header: "Type", value: (t) => TYPE_LABEL[t.type] },
  { header: "Account", value: (t) => t.account?.name ?? "" },
  { header: "Details", value: (t) => describe(t).text },
  {
    header: "Amount",
    value: (t) => `${CREDIT_TYPES.has(t.type) ? "+" : "-"}${t.amount} ${t.currency}`,
  },
  { header: "By", value: (t) => `${t.createdBy.firstName} ${t.createdBy.lastName}` },
  { header: "Date", value: (t) => formatDate(t.occurredAt) },
];

export default function AllTransactionsPage() {
  const allowed = usePermissionGuard("VIEW_FINANCE");
  const toast = useToast();
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const { page, limit, setPage, setLimit } = usePagination();
  const [total, setTotal] = useState(0);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAllAccountTransactions({ page, limit });
      setTransactions(result.transactions);
      setTotal(result.total);
    } catch (error) {
      toast.error("Failed to load transactions", getErrorMessage(error));
      setTransactions([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  if (!allowed) return null;

  const fetchAllForExport = () =>
    fetchAllPages((p, l) =>
      listAllAccountTransactions({ page: p, limit: l }).then((result) => ({
        items: result.transactions,
        total: result.total,
      })),
    );

  const handleExportExcel = async () => {
    setExporting("excel");
    try {
      const all = await fetchAllForExport();
      if (all.length === 0) {
        toast.info("Nothing to export", "No transactions recorded yet.");
        return;
      }
      exportToExcel(`all-transactions-${new Date().toISOString().slice(0, 10)}`, all, COLUMNS);
      toast.success(`Exported ${all.length} transaction${all.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error("Export failed", getErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting("pdf");
    try {
      const all = await fetchAllForExport();
      if (all.length === 0) {
        toast.info("Nothing to export", "No transactions recorded yet.");
        return;
      }
      await exportToPdf(
        `all-transactions-${new Date().toISOString().slice(0, 10)}`,
        "All Transactions",
        all,
        COLUMNS,
      );
      toast.success(`Exported ${all.length} transaction${all.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error("Export failed", getErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="All Transactions"
        description="Every transaction recorded across every account."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={fetchTransactions} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleExportExcel} disabled={exporting !== null}>
              <Download className="mr-2 h-4 w-4" />
              {exporting === "excel" ? "Exporting..." : "Export to Excel"}
            </Button>
            <Button onClick={handleExportPdf} disabled={exporting !== null}>
              <FileText className="mr-2 h-4 w-4" />
              {exporting === "pdf" ? "Exporting..." : "Export to PDF"}
            </Button>
          </>
        }
      />

      <AccountTransactionsTable transactions={transactions} loading={loading} showAccount />

      <ListPagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemLabel="transactions"
      />
    </div>
  );
}
