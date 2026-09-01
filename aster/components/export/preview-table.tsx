"use client";

import type { Key, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExportColumn } from "@/lib/export";

type PreviewTableProps<T> = {
  /** The exact column set the export uses — the preview is guaranteed to match the file. */
  columns: ExportColumn<T>[];
  rows: T[];
  loading?: boolean;
  emptyMessage?: string;
  rowKey?: (row: T, index: number) => Key;
  /** Optional caption shown above the table, e.g. a row count. */
  caption?: ReactNode;
};

export function PreviewTable<T>({
  columns,
  rows,
  loading,
  emptyMessage = "Nothing to show for the current filters.",
  rowKey,
  caption,
}: PreviewTableProps<T>) {
  return (
    <div className="space-y-2">
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.header}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, r) => (
                <TableRow key={`skeleton-${r}`}>
                  {columns.map((col) => (
                    <TableCell key={col.header}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={rowKey ? rowKey(row, i) : i}>
                  {columns.map((col) => (
                    <TableCell key={col.header}>{String(col.value(row) ?? "")}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
