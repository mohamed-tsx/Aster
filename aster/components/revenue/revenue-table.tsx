"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Revenue, RevenueCategory } from "@/types/revenue";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

const CATEGORY_LABELS: Record<RevenueCategory, string> = {
  HOSPITAL_REFERRAL_COMMISSION: "Hospital referral commission",
  OTHER_INCOME: "Other income",
};

type RevenueTableProps = {
  revenue: Revenue[];
  loading?: boolean;
};

export function RevenueTable({ revenue, loading }: RevenueTableProps) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (revenue.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm font-medium">No revenue recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Case</TableHead>
            <TableHead>Recorded by</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {revenue.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-muted-foreground">
                {formatDate(entry.receivedOn)}
              </TableCell>
              <TableCell className="font-medium">
                {CATEGORY_LABELS[entry.category]}
              </TableCell>
              <TableCell>
                {entry.amount} {entry.currency}
              </TableCell>
              <TableCell>{entry.account.name}</TableCell>
              <TableCell>{entry.case?.caseNumber ?? "—"}</TableCell>
              <TableCell>
                {entry.recordedBy.firstName} {entry.recordedBy.lastName}
              </TableCell>
              <TableCell>{entry.description ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
