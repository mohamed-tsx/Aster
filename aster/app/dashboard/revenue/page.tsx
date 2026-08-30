"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import { RevenueTable } from "@/components/revenue/revenue-table";
import { RevenueFormDialog } from "@/components/revenue/revenue-form-dialog";
import { ListPagination } from "@/components/pagination/list-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { listRevenue, createRevenue, getErrorMessage } from "@/services/revenue";
import type { RevenueFormValues } from "@/lib/validations/revenue";
import type { Revenue } from "@/types/revenue";

export default function RevenuePage() {
  const allowed = usePermissionGuard("VIEW_FINANCE");
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { page, limit, setPage, setLimit } = usePagination();
  const [total, setTotal] = useState(0);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listRevenue({ page, limit });
      setRevenue(result.revenue);
      setTotal(result.total);
    } catch (error) {
      toast.error("Failed to load revenue", getErrorMessage(error));
      setRevenue([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  if (!allowed) return null;

  const handleSubmit = async (values: RevenueFormValues) => {
    try {
      await createRevenue(values);
      toast.success("Revenue recorded");
      setDialogOpen(false);
      fetchRevenue();
    } catch (error) {
      toast.error("Could not record revenue", getErrorMessage(error));
      throw error;
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Revenue"
        description="Income received that isn't a visa fee — referral commission and other income."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={fetchRevenue} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {hasPermission("MANAGE_REVENUE") && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Record revenue
              </Button>
            )}
          </>
        }
      />

      <RevenueTable revenue={revenue} loading={loading} />

      <ListPagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemLabel="revenue"
      />

      <RevenueFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} />
    </div>
  );
}
