"use client";

import { use, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/users/page-header";
import { INTEREST_METHOD_LABELS } from "@/components/loans/loans-table";
import { RepaymentDialog } from "@/components/loans/repayment-dialog";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { getLoan, getErrorMessage } from "@/services/loans";
import type { Loan } from "@/types/loan";

type PageProps = { params: Promise<{ id: string }> };

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

export default function LoanDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const allowed = usePermissionGuard("VIEW_FINANCE");
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loanLoading, setLoanLoading] = useState(true);
  const [repaymentOpen, setRepaymentOpen] = useState(false);

  const fetchLoan = useCallback(async () => {
    setLoanLoading(true);
    try {
      setLoan(await getLoan(id));
    } catch (error) {
      toast.error("Failed to load loan", getErrorMessage(error));
      setLoan(null);
    } finally {
      setLoanLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchLoan();
  }, [fetchLoan]);

  if (!allowed) return null;

  if (loanLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!loan) {
    return <p className="text-sm text-muted-foreground">Loan not found.</p>;
  }

  const { projection } = loan;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title={loan.lenderName}
        description="Loan terms, computed balances and repayment history."
        backHref="/dashboard/loans"
        actions={
          <>
            <Badge variant={loan.status === "SETTLED" ? "outline" : "default"}>
              {loan.status === "SETTLED" ? "Settled" : "Active"}
            </Badge>
            <Button variant="outline" size="icon" onClick={fetchLoan} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {hasPermission("MANAGE_LOANS") && loan.status === "ACTIVE" && (
              <Button onClick={() => setRepaymentOpen(true)}>Record repayment</Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Terms</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Lender" value={loan.lenderName} />
            <DetailItem label="Principal" value={`${loan.principal} ${loan.currency}`} />
            <DetailItem
              label="Rate"
              value={`${loan.interestRatePct}% · ${INTEREST_METHOD_LABELS[loan.interestMethod]}`}
            />
            <DetailItem label="Term" value={`${loan.termMonths} months`} />
            <DetailItem label="Disbursed" value={formatDate(loan.disbursedOn)} />
            <DetailItem label="Due" value={formatDate(loan.dueOn)} />
            <DetailItem label="Account" value={loan.account.name} />
            <DetailItem
              label="Notes"
              value={loan.notes ? loan.notes : "—"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Balance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem
              label="Accrued interest"
              value={`${projection.accruedInterest.toFixed(2)} ${loan.currency}`}
            />
            <DetailItem
              label="Total repaid"
              value={`${projection.totalRepaid.toFixed(2)} ${loan.currency}`}
            />
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">Outstanding</p>
              <p
                className={
                  projection.isOverdue
                    ? "text-2xl font-bold text-destructive"
                    : "text-2xl font-bold"
                }
              >
                {projection.outstanding.toFixed(2)} {loan.currency}
              </p>
              {projection.isOverdue && <Badge variant="destructive">Overdue</Badge>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Repayments</CardTitle>
        </CardHeader>
        <CardContent>
          {loan.repayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repayments yet.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loan.repayments.map((repayment) => (
                    <TableRow key={repayment.id}>
                      <TableCell className="font-medium">
                        {repayment.amount} {loan.currency}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(repayment.paidOn)}
                      </TableCell>
                      <TableCell>{repayment.account?.name ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RepaymentDialog
        open={repaymentOpen}
        onOpenChange={setRepaymentOpen}
        loanId={loan.id}
        onSuccess={fetchLoan}
      />
    </div>
  );
}
