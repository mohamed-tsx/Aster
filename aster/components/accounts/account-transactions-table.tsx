"use client";

import Link from "next/link";
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
import type { AccountTransaction, AccountTransactionType } from "@/types/account";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

const TYPE_LABEL: Record<AccountTransactionType, string> = {
  OPENING_BALANCE: "Opening balance",
  PAYMENT_RECEIVED: "Payment received",
  EXPENSE_PAID: "Expense paid",
  REFUND_ISSUED: "Refund issued",
};

const CREDIT_TYPES = new Set<AccountTransactionType>(["OPENING_BALANCE", "PAYMENT_RECEIVED"]);

function describe(transaction: AccountTransaction): { text: string; caseId: string | null } {
  if (transaction.payment) {
    const kase = transaction.payment.visaApplication.case;
    return { text: `Case ${kase.caseNumber} · ${transaction.payment.visaApplication.travelerType}`, caseId: kase.id };
  }
  if (transaction.expense) {
    const kase = transaction.expense.case;
    return {
      text: kase ? `${transaction.expense.category} · Case ${kase.caseNumber}` : transaction.expense.category,
      caseId: kase?.id ?? null,
    };
  }
  if (transaction.refund) {
    const kase = transaction.refund.payment.visaApplication.case;
    return { text: `${transaction.refund.reason} · Case ${kase.caseNumber}`, caseId: kase.id };
  }
  return { text: transaction.notes || "—", caseId: null };
}

type AccountTransactionsTableProps = {
  transactions: AccountTransaction[];
  loading?: boolean;
};

export function AccountTransactionsTable({ transactions, loading }: AccountTransactionsTableProps) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm font-medium">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>By</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => {
            const { text, caseId } = describe(transaction);
            const isCredit = CREDIT_TYPES.has(transaction.type);
            return (
              <TableRow key={transaction.id}>
                <TableCell>
                  <Badge variant={isCredit ? "default" : "outline"}>
                    {TYPE_LABEL[transaction.type]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {caseId ? (
                    <Link href={`/dashboard/cases/${caseId}`} className="hover:underline">
                      {text}
                    </Link>
                  ) : (
                    text
                  )}
                </TableCell>
                <TableCell className={isCredit ? "text-emerald-600" : "text-destructive"}>
                  {isCredit ? "+" : "-"}
                  {transaction.amount} {transaction.currency}
                </TableCell>
                <TableCell>
                  {transaction.createdBy.firstName} {transaction.createdBy.lastName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(transaction.occurredAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
