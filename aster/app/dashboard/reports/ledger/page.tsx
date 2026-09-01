"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/users/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExportMenu } from "@/components/export/export-menu";
import { PreviewTable } from "@/components/export/preview-table";
import { ListPagination } from "@/components/pagination/list-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useToast } from "@/hooks/use-toast";
import { listAccounts, listAccountTransactions, getErrorMessage } from "@/services/accounts";
import { fetchAllPages, type ExportColumn } from "@/lib/export";
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
  const { page, limit, setPage, setLimit, resetPage } = usePagination();
  const [rows, setRows] = useState<AccountTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch((error) => toast.error("Failed to load accounts", getErrorMessage(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPreview = useCallback(async () => {
    if (!accountId) {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const result = await listAccountTransactions(accountId, { page, limit });
      setRows(result.transactions);
      setTotal(result.total);
    } catch (error) {
      toast.error("Failed to load transactions", getErrorMessage(error));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, page, limit]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  if (!allowed) return null;

  const account = accounts.find((a) => a.id === accountId);

  const fetchAllRows = () =>
    fetchAllPages((p, l) =>
      listAccountTransactions(accountId, { page: p, limit: l }).then((result) => ({
        items: result.transactions,
        total: result.total,
      })),
    );

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Account ledger report"
        description="Pick an account to preview and export its full transaction history."
        actions={
          <ExportMenu
            filename={`ledger-${account?.name ?? "account"}`}
            pdfTitle={`Ledger — ${account?.name ?? "Account"}`}
            columns={COLUMNS}
            fetchRows={fetchAllRows}
            disabled={!accountId}
          />
        }
      />

      <Select
        value={accountId}
        onValueChange={(value) => {
          setAccountId(value);
          resetPage();
        }}
      >
        <SelectTrigger className="w-full sm:w-[260px]">
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

      <PreviewTable
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        rowKey={(t) => t.id}
        emptyMessage={accountId ? "This account has no transactions." : "Select an account to begin."}
        caption={accountId && !loading ? `${total} transaction${total === 1 ? "" : "s"} — showing page ${page}` : undefined}
      />

      {accountId ? (
        <ListPagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          itemLabel="transactions"
        />
      ) : null}
    </div>
  );
}
