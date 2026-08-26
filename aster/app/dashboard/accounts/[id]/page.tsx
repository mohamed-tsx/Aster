"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import { AccountTransactionsTable } from "@/components/accounts/account-transactions-table";
import { ListPagination } from "@/components/pagination/list-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useToast } from "@/hooks/use-toast";
import { listAccounts, listAccountTransactions, getErrorMessage } from "@/services/accounts";
import type { Account, AccountTransaction } from "@/types/account";

function formatBalances(balances: Account["balances"]) {
  return (
    Object.entries(balances)
      .filter(([, amount]) => amount !== 0)
      .map(([currency, amount]) => `${amount.toFixed(2)} ${currency}`)
      .join(" · ") || "—"
  );
}

type PageProps = { params: Promise<{ id: string }> };

export default function AccountDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const allowed = usePermissionGuard("MANAGE_ACCOUNTS");
  const toast = useToast();
  const [account, setAccount] = useState<Account | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const { page, limit, setPage, setLimit } = usePagination();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setAccountLoading(true);
    listAccounts()
      .then((accounts) => setAccount(accounts.find((a) => a.id === id) ?? null))
      .catch((error) => toast.error("Failed to load account", getErrorMessage(error)))
      .finally(() => setAccountLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const result = await listAccountTransactions(id, { page, limit });
      setTransactions(result.transactions);
      setTotal(result.total);
    } catch (error) {
      toast.error("Failed to load transactions", getErrorMessage(error));
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  if (!allowed) return null;

  if (accountLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return <p className="text-sm text-muted-foreground">Account not found.</p>;
  }

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title={account.name}
        description="Transaction history for this account."
        backHref="/dashboard/accounts"
        actions={
          <>
            <Badge variant="outline">{account.type}</Badge>
            <Button variant="outline" size="icon" onClick={fetchTransactions} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <p className="text-lg font-medium">{formatBalances(account.balances)}</p>

      <AccountTransactionsTable transactions={transactions} loading={transactionsLoading} />

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
