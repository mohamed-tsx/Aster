"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import { CaseFilters, type CaseFiltersValue } from "@/components/cases/case-filters";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useToast } from "@/hooks/use-toast";
import { listCases, getErrorMessage } from "@/services/cases";
import { exportToExcel, fetchAllPages, type ExportColumn } from "@/lib/export";
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
  const [exporting, setExporting] = useState(false);

  if (!allowed) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const cases = await fetchAllPages((page, limit) =>
        listCases({
          page,
          limit,
          status: filters.status || undefined,
          reachOutType: filters.reachOutType || undefined,
          assignedToId: filters.assignedToId || undefined,
          q: filters.q || undefined,
        }).then((result) => ({ items: result.cases, total: result.total })),
      );

      if (cases.length === 0) {
        toast.info("Nothing to export", "No cases match the current filters.");
        return;
      }

      exportToExcel(`case-list-${new Date().toISOString().slice(0, 10)}`, cases, COLUMNS);
      toast.success(`Exported ${cases.length} case${cases.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error("Export failed", getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Case list report"
        description="Export cases matching the filters below to Excel."
        actions={
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export to Excel
          </Button>
        }
      />

      <CaseFilters value={filters} onChange={setFilters} />
    </div>
  );
}
