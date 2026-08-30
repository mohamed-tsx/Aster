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
import { cn } from "@/lib/utils";
import type { Loan, LoanInterestMethod } from "@/types/loan";

export const INTEREST_METHOD_LABELS: Record<LoanInterestMethod, string> = {
  SIMPLE: "Simple",
  COMPOUND_MONTHLY: "Compound (monthly)",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type LoansTableProps = {
  loans: Loan[];
  loading?: boolean;
};

export function LoansTable({ loans, loading }: LoansTableProps) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm font-medium">No loans recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lender</TableHead>
            <TableHead>Principal</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Outstanding</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => (
            <TableRow key={loan.id}>
              <TableCell className="font-medium">
                <Link href={`/dashboard/loans/${loan.id}`} className="hover:underline">
                  {loan.lenderName}
                </Link>
              </TableCell>
              <TableCell>
                {loan.principal} {loan.currency}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {loan.interestRatePct}% · {INTEREST_METHOD_LABELS[loan.interestMethod]}
              </TableCell>
              <TableCell
                className={cn(loan.projection.isOverdue && "text-destructive font-medium")}
              >
                {loan.projection.outstanding.toFixed(2)} {loan.currency}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(loan.dueOn)}</TableCell>
              <TableCell>
                <Badge variant={loan.status === "SETTLED" ? "outline" : "default"}>
                  {loan.status === "SETTLED" ? "Settled" : "Active"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
