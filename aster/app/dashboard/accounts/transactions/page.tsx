"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import {
  AccountTransactionsTable,
  TYPE_LABEL,
  CREDIT_TYPES,
  describe,
} from "@/components/accounts/account-transactions-table";
import { ExportMenu } from "@/components/export/export-menu";
import { ListPagination } from "@/components/pagination/list-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useToast } from "@/hooks/use-toast";
import { listAllAccountTransactions, getErrorMessage } from "@/services/accounts";
import { fetchAllPages, type ExportColumn } from "@/lib/export";
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
            <ExportMenu
              filename="all-transactions"
              pdfTitle="All Transactions"
              columns={COLUMNS}
              fetchRows={fetchAllForExport}
            />
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
