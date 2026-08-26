"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Expense } from "@/types/expense";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type ExpensesTableProps = {
  expenses: Expense[];
  loading?: boolean;
};

export function ExpensesTable({ expenses, loading }: ExpensesTableProps) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm font-medium">No expenses found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Case</TableHead>
            <TableHead>Paid by</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell className="font-medium">{expense.category}</TableCell>
              <TableCell>
                {expense.amount} {expense.currency}
              </TableCell>
              <TableCell>{expense.accountTransaction?.account.name ?? "—"}</TableCell>
              <TableCell>
                {expense.case ? (
                  <Link
                    href={`/dashboard/cases/${expense.case.id}`}
                    className="hover:underline"
                  >
                    {expense.case.caseNumber}
                  </Link>
                ) : (
                  "General"
                )}
              </TableCell>
              <TableCell>
                {expense.paidBy.firstName} {expense.paidBy.lastName}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(expense.incurredAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
