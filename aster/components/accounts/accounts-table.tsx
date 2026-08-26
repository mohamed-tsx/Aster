"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  listAccounts,
  createAccount,
  getErrorMessage,
} from "@/services/accounts";
import { buildAccountPayload, type AccountFormValues } from "@/lib/validations/account";
import type { Account } from "@/types/account";

function formatBalances(balances: Account["balances"]) {
  return Object.entries(balances)
    .filter(([, amount]) => amount !== 0)
    .map(([currency, amount]) => `${amount.toFixed(2)} ${currency}`)
    .join(" · ") || "—";
}

export function AccountsTable() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await listAccounts());
    } catch (error) {
      toast.error("Failed to load accounts", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSubmit = async (values: AccountFormValues) => {
    try {
      await createAccount(buildAccountPayload(values));
      toast.success("Account created");
      setDialogOpen(false);
      fetchAll();
    } catch (error) {
      toast.error("Save failed", getErrorMessage(error));
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add account
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  No accounts yet.
                </TableCell>
              </TableRow>
            )}
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">
                  <Link href={`/dashboard/accounts/${account.id}`} className="hover:underline">
                    {account.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{account.type}</Badge>
                </TableCell>
                <TableCell>{formatBalances(account.balances)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AccountFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} />
    </div>
  );
}
