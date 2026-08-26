"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import { CasesTable } from "@/components/cases/cases-table";
import { CaseFilters, type CaseFiltersValue } from "@/components/cases/case-filters";
import { ListPagination } from "@/components/pagination/list-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useRBAC } from "@/hooks/useRBAC";
import { listCases } from "@/services/cases";
import type { CaseListItem } from "@/types/case";

export default function CasesPage() {
  const allowed = usePermissionGuard("VIEW_CASES");
  const { hasPermission } = useRBAC();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { page, limit, setPage, setLimit, resetPage } = usePagination();
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<CaseFiltersValue>({
    status: "",
    reachOutType: "",
    assignedToId: "",
    q: "",
  });

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCases({
        page,
        limit,
        status: filters.status || undefined,
        reachOutType: filters.reachOutType || undefined,
        assignedToId: filters.assignedToId || undefined,
        q: filters.q || undefined,
      });
      setCases(result.cases);
      setTotal(result.total);
    } catch (error) {
      console.error(error);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  const handleFiltersChange = (next: CaseFiltersValue) => {
    setFilters(next);
    resetPage();
  };

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Cases"
        description="Track patient referral cases end to end."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={fetchCases} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {hasPermission("CREATE_CASES") && (
              <Button asChild>
                <Link href="/dashboard/cases/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add case
                </Link>
              </Button>
            )}
          </>
        }
      />

      <CaseFilters value={filters} onChange={handleFiltersChange} />

      <CasesTable cases={cases} loading={loading} />

      <ListPagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemLabel="cases"
      />
    </div>
  );
}
