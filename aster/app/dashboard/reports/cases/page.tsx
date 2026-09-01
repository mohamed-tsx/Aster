"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/users/page-header";
import { CaseFilters, type CaseFiltersValue } from "@/components/cases/case-filters";
import { ExportMenu } from "@/components/export/export-menu";
import { PreviewTable } from "@/components/export/preview-table";
import { ListPagination } from "@/components/pagination/list-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useToast } from "@/hooks/use-toast";
import { listCases, getErrorMessage } from "@/services/cases";
import { fetchAllPages, type ExportColumn } from "@/lib/export";
import type { CaseListItem } from "@/types/case";

const COLUMNS: ExportColumn<CaseListItem>[] = [
  { header: "Case #", value: (c) => c.caseNumber },
  { header: "Status", value: (c) => c.status },
  { header: "Source", value: (c) => (c.reachOutType === "AGENCY" ? c.agency?.name ?? "Agency" : "Direct") },
  { header: "Patient", value: (c) => `${c.patient.firstName} ${c.patient.lastName}` },
  { header: "Passport #", value: (c) => c.patient.passportNumber ?? "—" },
  {
    header: "Assigned to",
    value: (c) => (c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : ""),
  },
  { header: "Created", value: (c) => new Date(c.createdAt).toISOString().slice(0, 10) },
];

export default function CaseListReportPage() {
  const allowed = usePermissionGuard("VIEW_CASES");
  const toast = useToast();
  const [filters, setFilters] = useState<CaseFiltersValue>({
    status: "",
    reachOutType: "",
    assignedToId: "",
    q: "",
  });
  const { page, limit, setPage, setLimit, resetPage } = usePagination();
  const [rows, setRows] = useState<CaseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const params = useCallback(
    () => ({
      status: filters.status || undefined,
      reachOutType: filters.reachOutType || undefined,
      assignedToId: filters.assignedToId || undefined,
      q: filters.q || undefined,
    }),
    [filters],
  );

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCases({ page, limit, ...params() });
      setRows(result.cases);
      setTotal(result.total);
    } catch (error) {
      toast.error("Failed to load cases", getErrorMessage(error));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, params]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  if (!allowed) return null;

  const handleFiltersChange = (next: CaseFiltersValue) => {
    setFilters(next);
    resetPage();
  };

  const fetchAllRows = () =>
    fetchAllPages((p, l) =>
      listCases({ page: p, limit: l, ...params() }).then((result) => ({
        items: result.cases,
        total: result.total,
      })),
    );

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Case list report"
        description="Filter, preview, and export the case list to Excel or PDF."
        actions={
          <ExportMenu
            filename="case-list"
            pdfTitle="Case List"
            columns={COLUMNS}
            fetchRows={fetchAllRows}
          />
        }
      />

      <CaseFilters value={filters} onChange={handleFiltersChange} />

      <PreviewTable
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        rowKey={(c) => c.id}
        caption={loading ? undefined : `${total} case${total === 1 ? "" : "s"} match — showing page ${page}`}
      />

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
