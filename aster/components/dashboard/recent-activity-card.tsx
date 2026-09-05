"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ActivityItem, ActivityType } from "@/types/dashboard";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

const DESCRIBE: Record<ActivityType, (item: ActivityItem) => string> = {
  CASE_CREATED: () => "New case created",
  PAYMENT_RECEIVED: (item) => `Payment received: ${item.amount} ${item.currency}`,
  EXPENSE_PAID: (item) => `Expense recorded: ${item.category} — ${item.amount} ${item.currency}`,
  REFUND_ISSUED: (item) => `Refund issued: ${item.amount}`,
  DOCUMENT_UPLOADED: (item) => `Document uploaded: ${item.fileName}`,
};

const TYPE_BADGE_VARIANT: Record<ActivityType, "default" | "secondary" | "destructive" | "outline"> = {
  CASE_CREATED: "default",
  PAYMENT_RECEIVED: "secondary",
  EXPENSE_PAID: "outline",
  REFUND_ISSUED: "destructive",
  DOCUMENT_UPLOADED: "outline",
};

const TYPE_LABEL: Record<ActivityType, string> = {
  CASE_CREATED: "Case",
  PAYMENT_RECEIVED: "Payment",
  EXPENSE_PAID: "Expense",
  REFUND_ISSUED: "Refund",
  DOCUMENT_UPLOADED: "Document",
};

export function RecentActivityCard({ activity }: { activity: ActivityItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activity;
    return activity.filter((item) => {
      const description = DESCRIBE[item.type](item).toLowerCase();
      return description.includes(q) || item.caseNumber?.toLowerCase().includes(q);
    });
  }, [activity, query]);

  return (
    <Card className="gap-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Recent activity</CardTitle>
        <div className="relative w-48">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activity"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Case</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item, index) => (
                <TableRow key={`${item.type}-${item.occurredAt}-${index}`}>
                  <TableCell>
                    <Badge variant={TYPE_BADGE_VARIANT[item.type]}>{TYPE_LABEL[item.type]}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm">
                    {DESCRIBE[item.type](item)}
                  </TableCell>
                  <TableCell>
                    {item.caseId && item.caseNumber ? (
                      <Link
                        href={`/dashboard/cases/${item.caseId}`}
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {item.caseNumber}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatDateTime(item.occurredAt)}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    No activity matches “{query}”.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
