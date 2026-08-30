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
import { PayablesTable } from "@/components/payables/payables-table";
import { PayableFormDialog } from "@/components/payables/payable-form-dialog";
import { SettlePayableDialog } from "@/components/payables/settle-payable-dialog";
import { ListPagination } from "@/components/pagination/list-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { listPayables, createPayable, getErrorMessage } from "@/services/payables";
import type { CreatePayablePayload } from "@/services/payables";
import type { Payable, PayableStatus } from "@/types/payable";

const ALL = "__all__";

export default function PayablesPage() {
  const allowed = usePermissionGuard("VIEW_FINANCE");
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settlingPayable, setSettlingPayable] = useState<Payable | null>(null);
  const [status, setStatus] = useState<PayableStatus | "">("");
  const { page, limit, setPage, setLimit, resetPage } = usePagination();
  const [total, setTotal] = useState(0);

  const fetchPayables = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPayables({ page, limit, status: status || undefined });
      setPayables(result.payables);
      setTotal(result.total);
    } catch (error) {
      toast.error("Failed to load payables", getErrorMessage(error));
      setPayables([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, status]);

  useEffect(() => {
    fetchPayables();
  }, [fetchPayables]);

  if (!allowed) return null;

  const handleStatusChange = (value: string) => {
    setStatus(value === ALL ? "" : (value as PayableStatus));
    resetPage();
  };

  const handleSubmit = async (payload: CreatePayablePayload) => {
    try {
      await createPayable(payload);
      toast.success("Payable recorded");
      setDialogOpen(false);
      fetchPayables();
    } catch (error) {
      toast.error("Could not record payable", getErrorMessage(error));
      throw error;
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Payables"
        description="Money Aster owes out — settled from an account when paid."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={fetchPayables} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {hasPermission("MANAGE_PAYABLES") && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New payable
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
          <SelectItem value="OUTSTANDING">Outstanding</SelectItem>
          <SelectItem value="SETTLED">Settled</SelectItem>
        </SelectContent>
      </Select>

      <PayablesTable
        payables={payables}
        loading={loading}
        canSettle={hasPermission("MANAGE_PAYABLES")}
        onSettle={setSettlingPayable}
      />

      <ListPagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemLabel="payables"
      />

      <PayableFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} />

      <SettlePayableDialog
        open={!!settlingPayable}
        onOpenChange={(o) => !o && setSettlingPayable(null)}
        payable={settlingPayable}
        onSuccess={() => {
          setSettlingPayable(null);
          fetchPayables();
        }}
      />
    </div>
  );
}
