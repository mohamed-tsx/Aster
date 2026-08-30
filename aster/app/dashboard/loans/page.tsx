"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/users/page-header";
import { LoansTable } from "@/components/loans/loans-table";
import { LoanFormDialog } from "@/components/loans/loan-form-dialog";
import { ListPagination } from "@/components/pagination/list-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { listLoans, createLoan, getErrorMessage } from "@/services/loans";
import type { CreateLoanPayload } from "@/services/loans";
import type { Loan, LoanStatus } from "@/types/loan";

const ALL = "__all__";

export default function LoansPage() {
  const allowed = usePermissionGuard("VIEW_FINANCE");
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState<LoanStatus | "">("");
  const { page, limit, setPage, setLimit, resetPage } = usePagination();
  const [total, setTotal] = useState(0);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listLoans({ page, limit, status: status || undefined });
      setLoans(result.loans);
      setTotal(result.total);
    } catch (error) {
      toast.error("Failed to load loans", getErrorMessage(error));
      setLoans([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, status]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  if (!allowed) return null;

  const handleStatusChange = (value: string) => {
    setStatus(value === ALL ? "" : (value as LoanStatus));
    resetPage();
  };

  const handleSubmit = async (payload: CreateLoanPayload) => {
    try {
      await createLoan(payload);
      toast.success("Loan recorded");
      setDialogOpen(false);
      fetchLoans();
    } catch (error) {
      toast.error("Could not record loan", getErrorMessage(error));
      throw error;
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Loans"
        description="Money borrowed from lenders, with computed interest and outstanding balances."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={fetchLoans} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {hasPermission("MANAGE_LOANS") && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New loan
              </Button>
            )}
          </>
        }
      />

      <Select value={status || ALL} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-full sm:w-[170px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          <SelectItem value="ACTIVE">Active</SelectItem>
          <SelectItem value="SETTLED">Settled</SelectItem>
        </SelectContent>
      </Select>

      <LoansTable loans={loans} loading={loading} />

      <ListPagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemLabel="loans"
      />

      <LoanFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} />
    </div>
  );
}
