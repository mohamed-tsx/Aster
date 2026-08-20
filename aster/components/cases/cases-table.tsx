"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRBAC } from "@/hooks/useRBAC";
import type { CaseListItem, CaseStatus } from "@/types/case";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_VARIANT: Record<CaseStatus, "default" | "secondary" | "destructive" | "outline"> = {
  NEW: "secondary",
  HOSPITAL_MATCHING: "outline",
  HOSPITAL_ACCEPTED: "default",
  HOSPITAL_DECLINED: "destructive",
  VISA_PROCESSING: "default",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>{status.replace(/_/g, " ")}</Badge>
  );
}

type CasesTableProps = {
  cases: CaseListItem[];
  loading?: boolean;
};

export function CasesTable({ cases, loading }: CasesTableProps) {
  const { hasPermission } = useRBAC();

  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm font-medium">No cases found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting filters or create a new case.
        </p>
        {hasPermission("CREATE_CASES") && (
          <Button className="mt-4" asChild>
            <Link href="/dashboard/cases/new">Add case</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Case #</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Assigned to</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((kase) => (
            <TableRow key={kase.id}>
              <TableCell>
                <Link
                  href={`/dashboard/cases/${kase.id}`}
                  className="font-medium hover:underline"
                >
                  {kase.caseNumber}
                </Link>
              </TableCell>
              <TableCell>
                {kase.patient.firstName} {kase.patient.lastName}
                <p className="text-xs text-muted-foreground">
                  {kase.patient.passportNumber}
                </p>
              </TableCell>
              <TableCell>
                <StatusBadge status={kase.status} />
              </TableCell>
              <TableCell>
                {kase.reachOutType === "AGENCY" && kase.agency
                  ? `Agency: ${kase.agency.name}`
                  : "Direct"}
              </TableCell>
              <TableCell>
                {kase.assignedTo
                  ? `${kase.assignedTo.firstName} ${kase.assignedTo.lastName}`
                  : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(kase.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
