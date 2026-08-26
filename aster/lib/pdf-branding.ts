import type jsPDF from "jspdf";

// Brand palette — kept in sync with the CSS custom properties in
// app/globals.css (--primary, --accent, --secondary, --foreground,
// --muted-foreground). jsPDF needs plain RGB triplets, not CSS vars.
export const PDF_COLORS = {
  primary: [13, 79, 146] as [number, number, number], // #0d4f92
  primaryDark: [8, 61, 115] as [number, number, number], // #083d73
  accent: [22, 181, 140] as [number, number, number], // #16b58c
  soft: [234, 243, 250] as [number, number, number], // #eaf3fa
  text: [11, 23, 38] as [number, number, number], // #0b1726
  muted: [82, 97, 111] as [number, number, number], // #52616f
  white: [255, 255, 255] as [number, number, number],
};

const FONT_FILES = {
  regular: {
    url: "/fonts/Poppins-Regular.ttf",
    vfsName: "Poppins-Regular.ttf",
  },
  semibold: {
    url: "/fonts/Poppins-SemiBold.ttf",
    vfsName: "Poppins-SemiBold.ttf",
  },
  bold: { url: "/fonts/Poppins-Bold.ttf", vfsName: "Poppins-Bold.ttf" },
};

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Fetched once per page load and reused across every export in the session.
let fontsRegistered: Promise<void> | null = null;
let logoDataUrl: Promise<string | null> | null = null;

/** Registers the Poppins family (regular/semibold/bold) on a jsPDF document. */
export async function usePoppins(doc: jsPDF): Promise<void> {
  if (!fontsRegistered) {
    fontsRegistered = (async () => {
      const entries = Object.values(FONT_FILES);
      const base64s = await Promise.all(
        entries.map(async (f) => {
          const buffer = await fetch(f.url).then((r) => r.arrayBuffer());
          return arrayBufferToBase64(buffer);
        }),
      );
      entries.forEach((f, i) => {
        doc.addFileToVFS(f.vfsName, base64s[i]);
      });
    })();
  }
  await fontsRegistered;

  doc.addFont(FONT_FILES.regular.vfsName, "Poppins", "normal");
  doc.addFont(FONT_FILES.semibold.vfsName, "Poppins", "semibold");
  doc.addFont(FONT_FILES.bold.vfsName, "Poppins", "bold");
  doc.setFont("Poppins", "normal");
}

/** Rasterizes the app's logo.svg to a PNG data URL (jsPDF can't embed SVG directly). */
async function loadLogo(): Promise<string | null> {
  try {
    const svgText = await fetch("/logo.svg").then((r) => r.text());
    const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = svgUrl;
    });

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, size, size);
    URL.revokeObjectURL(svgUrl);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export function getLogoDataUrl(): Promise<string | null> {
  if (!logoDataUrl) logoDataUrl = loadLogo();
  return logoDataUrl;
}

/**
 * Draws the shared report letterhead (logo, brand name, report title, date)
 * and a footer (page number + generated-by line) on every page.
 * Returns the Y position content should start below.
 */
export async function drawLetterhead(
  doc: jsPDF,
  reportTitle: string,
): Promise<number> {
  await usePoppins(doc);
  const logo = await getLogoDataUrl();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  if (logo) {
    doc.addImage(logo, "PNG", margin, 10, 16, 16);
  }

  const textX = logo ? margin + 20 : margin;
  doc.setFont("Poppins", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PDF_COLORS.primary);
  doc.text("Aster", textX, 17);

  doc.setFont("Poppins", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("Hospital Referral Center", textX, 22.5);

  doc.setFont("Poppins", "semibold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.text);
  doc.text(reportTitle, pageWidth - margin, 16, { align: "right" });

  doc.setFont("Poppins", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(
    new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date()),
    pageWidth - margin,
    21.5,
    { align: "right" },
  );

  doc.setDrawColor(...PDF_COLORS.accent);
  doc.setLineWidth(0.8);
  doc.line(margin, 28, pageWidth - margin, 28);

  return 34;
}

export function drawFooter(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const y = pageHeight - 10;

  doc.setDrawColor(...PDF_COLORS.soft);
  doc.setLineWidth(0.3);
  doc.line(margin, y - 4, pageWidth - margin, y - 4);

  doc.setFont("Poppins", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("Generated by Aster ERP", margin, y);

  // getNumberOfPages() inside a didDrawPage callback only reflects pages
  // rendered so far, not the final total — fine here since these reports
  // are small enough to stay on one page in practice.
  const currentPage = doc.getCurrentPageInfo().pageNumber;
  const totalPages = doc.getNumberOfPages();
  doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, y, {
    align: "right",
  });
}
