"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Payable } from "@/types/payable";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type PayablesTableProps = {
  payables: Payable[];
  loading?: boolean;
  canSettle: boolean;
  onSettle: (payable: Payable) => void;
};

export function PayablesTable({ payables, loading, canSettle, onSettle }: PayablesTableProps) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (payables.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm font-medium">No payables recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Payee</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Case</TableHead>
            <TableHead>Raised</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[1%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {payables.map((payable) => (
            <TableRow key={payable.id}>
              <TableCell className="font-medium">{payable.payeeName}</TableCell>
              <TableCell>
                {payable.amount} {payable.currency}
              </TableCell>
              <TableCell className="text-muted-foreground">{payable.reason}</TableCell>
              <TableCell className="text-muted-foreground">
                {payable.case?.caseNumber ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(payable.raisedOn)}
              </TableCell>
              <TableCell>
                <Badge variant={payable.status === "SETTLED" ? "outline" : "default"}>
                  {payable.status === "SETTLED" ? "Settled" : "Outstanding"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {payable.status === "OUTSTANDING" && canSettle && (
                  <Button variant="outline" size="sm" onClick={() => onSettle(payable)}>
                    Settle
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
