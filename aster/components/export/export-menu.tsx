"use client";

import { useState } from "react";
import { ChevronDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/api";
import { exportToExcel, exportToPdf, type ExportColumn } from "@/lib/export";

type ExportMenuProps<T> = {
  /** Base file name, no extension — the current date is appended automatically. */
  filename: string;
  /** Title printed on the PDF letterhead. */
  pdfTitle: string;
  /** Same column set the on-screen preview uses, so file === preview. */
  columns: ExportColumn<T>[];
  /** Resolves the FULL row set (all pages), fetched only when an export is chosen. */
  fetchRows: () => Promise<T[]>;
  disabled?: boolean;
  size?: "sm" | "default";
  variant?: "default" | "outline";
  align?: "start" | "end";
  label?: string;
};

const dated = (name: string) => `${name}-${new Date().toISOString().slice(0, 10)}`;

export function ExportMenu<T>({
  filename,
  pdfTitle,
  columns,
  fetchRows,
  disabled,
  size = "default",
  variant = "outline",
  align = "end",
  label = "Export",
}: ExportMenuProps<T>) {
  const toast = useToast();
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);

  const run = async (format: "excel" | "pdf") => {
    setBusy(format);
    try {
      const rows = await fetchRows();
      if (rows.length === 0) {
        toast.info("Nothing to export", "No rows match the current filters.");
        return;
      }
      if (format === "excel") {
        exportToExcel(dated(filename), rows, columns);
      } else {
        await exportToPdf(dated(filename), pdfTitle, rows, columns);
      }
      toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error("Export failed", getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || busy !== null}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className="mr-2 h-4 w-4" />
          )}
          {busy ? "Exporting…" : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuItem onSelect={() => run("excel")} disabled={busy !== null}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export to Excel
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("pdf")} disabled={busy !== null}>
          <FileText className="mr-2 h-4 w-4" />
          Export to PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
