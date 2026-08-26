import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDF_COLORS, drawLetterhead, drawFooter } from "@/lib/pdf-branding";

export type ExportColumn<T> = { header: string; value: (row: T) => string | number };

/**
 * Loops a paginated `list*` service call until it's exhausted, for exports
 * (which need the full result set, not one page). Caps at 20 pages / a
 * server-side `limit` of 100 each — 2000 rows — as a sane ceiling.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
  limit = 100,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  for (; page <= 20; page++) {
    const { items, total } = await fetchPage(page, limit);
    all.push(...items);
    if (all.length >= total || items.length === 0) break;
  }
  return all;
}

export function exportToExcel<T>(filename: string, rows: T[], columns: ExportColumn<T>[]) {
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((col) => [col.header, col.value(row)])),
  );
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportToPdf<T>(
  filename: string,
  title: string,
  rows: T[],
  columns: ExportColumn<T>[],
) {
  const doc = new jsPDF();
  const startY = await drawLetterhead(doc, title);

  autoTable(doc, {
    startY,
    margin: { left: 14, right: 14 },
    head: [columns.map((col) => col.header)],
    body: rows.map((row) => columns.map((col) => col.value(row))),
    styles: {
      font: "Poppins",
      fontSize: 9,
      textColor: PDF_COLORS.text,
      lineColor: PDF_COLORS.soft,
      lineWidth: 0.2,
      cellPadding: 3,
    },
    headStyles: {
      font: "Poppins",
      fontStyle: "bold",
      fillColor: PDF_COLORS.primary,
      textColor: PDF_COLORS.white,
      halign: "left",
    },
    alternateRowStyles: { fillColor: PDF_COLORS.soft },
    didDrawPage: () => drawFooter(doc),
  });

  doc.save(`${filename}.pdf`);
}
