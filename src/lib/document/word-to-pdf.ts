import { isValidPdfSignature } from "../pdf/common";

export type WordPdfPageSize = "a4" | "letter";
export type WordPdfOrientation = "portrait" | "landscape";
export type WordPdfMargin = "normal" | "narrow" | "wide";

export interface WordToPdfOptions {
  pageSize?: WordPdfPageSize;
  orientation?: WordPdfOrientation;
  margin?: WordPdfMargin;
  onProgress?: (stage: string) => void;
}

export interface WordToPdfResult {
  blob: Blob;
  filename: string;
  pageCount: number;
  originalSizeBytes: number;
  outputSizeBytes: number;
  executionTimeMs: number;
  paragraphCount: number;
}

const PAGE_DIMS: Record<WordPdfPageSize, { widthMm: number; heightMm: number }> = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
};

const MARGIN_DIMS: Record<WordPdfMargin, number> = {
  normal: 20, // 20mm
  narrow: 10, // 10mm
  wide: 30, // 30mm
};

/**
 * Validates whether the byte sequence is a valid DOCX (OpenXML ZIP container).
 */
export async function isValidDocxFile(file: File): Promise<{ isValid: boolean; error?: string }> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".doc") && !lowerName.endsWith(".docx")) {
    return {
      isValid: false,
      error: "Legacy .doc files are not currently supported. Please upload a .docx file.",
    };
  }

  if (!lowerName.endsWith(".docx")) {
    return {
      isValid: false,
      error: "Unsupported format. Only modern Microsoft Word (.docx) documents are supported.",
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const jszipModule = await import("jszip");
    const JSZip = jszipModule.default || jszipModule;
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Verify key OpenXML parts exist
    const hasDocumentXml = zip.file("word/document.xml") !== null;
    const hasContentTypes = zip.file("[Content_Types].xml") !== null;

    if (!hasDocumentXml || !hasContentTypes) {
      return {
        isValid: false,
        error: "Corrupted or non-standard Word document: Missing word/document.xml.",
      };
    }

    return { isValid: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isValid: false,
      error: `Unable to parse Word document archive: ${msg}`,
    };
  }
}

/**
 * Converts a .docx document into a clean, searchable vector PDF file.
 */
export async function convertWordToPdf(
  file: File,
  options: WordToPdfOptions = {}
): Promise<WordToPdfResult> {
  const startTime = performance.now();

  options.onProgress?.("Reading DOCX...");

  const validation = await isValidDocxFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error || "Invalid .docx document.");
  }

  const arrayBuffer = await file.arrayBuffer();

  options.onProgress?.("Parsing document structure...");

  const mammoth = await import("mammoth");
  const parseResult = await mammoth.convertToHtml({ arrayBuffer });
  const html = parseResult.value;

  options.onProgress?.("Preparing layout & pagination...");

  const {
    pageSize = "a4",
    orientation = "portrait",
    margin = "normal",
  } = options;

  const baseDim = PAGE_DIMS[pageSize];
  const widthMm = orientation === "portrait" ? baseDim.widthMm : baseDim.heightMm;
  const heightMm = orientation === "portrait" ? baseDim.heightMm : baseDim.widthMm;
  const marginMm = MARGIN_DIMS[margin];
  const printableWidthMm = widthMm - marginMm * 2;

  // Initialize jsPDF for vector rendering
  const jspdfModule = await import("jspdf");
  const doc = new jspdfModule.jsPDF({
    orientation,
    unit: "mm",
    format: [widthMm, heightMm],
    compress: true,
  });

  let currentY = marginMm + 10;
  let paragraphCount = 0;

  // Helper to add a new page if content overflows
  const ensureSpace = (neededHeightMm: number) => {
    if (currentY + neededHeightMm > heightMm - marginMm) {
      doc.addPage([widthMm, heightMm], orientation);
      currentY = marginMm + 10;
    }
  };

  // Parse HTML blocks client-side using DOMParser
  if (typeof window !== "undefined") {
    const parser = new DOMParser();
    const docDom = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const container = docDom.body.firstElementChild;

    if (container) {
      const childNodes = Array.from(container.children);

      for (const el of childNodes) {
        const tagName = el.tagName.toLowerCase();
        const textContent = el.textContent?.trim() || "";

        if (!textContent && tagName !== "hr") continue;

        if (tagName === "h1") {
          ensureSpace(14);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(18);
          doc.setTextColor(20, 20, 20);
          const lines = doc.splitTextToSize(textContent, printableWidthMm);
          doc.text(lines, marginMm, currentY);
          currentY += lines.length * 8 + 4;
          paragraphCount++;
        } else if (tagName === "h2") {
          ensureSpace(12);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(15);
          doc.setTextColor(40, 40, 40);
          const lines = doc.splitTextToSize(textContent, printableWidthMm);
          doc.text(lines, marginMm, currentY);
          currentY += lines.length * 7 + 3;
          paragraphCount++;
        } else if (tagName === "h3") {
          ensureSpace(10);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.setTextColor(60, 60, 60);
          const lines = doc.splitTextToSize(textContent, printableWidthMm);
          doc.text(lines, marginMm, currentY);
          currentY += lines.length * 6 + 3;
          paragraphCount++;
        } else if (tagName === "ul" || tagName === "ol") {
          const items = Array.from(el.querySelectorAll("li"));
          for (let i = 0; i < items.length; i++) {
            const liText = items[i].textContent?.trim() || "";
            if (!liText) continue;
            ensureSpace(7);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10.5);
            doc.setTextColor(30, 30, 30);
            const prefix = tagName === "ol" ? `${i + 1}. ` : "• ";
            const bulletLines = doc.splitTextToSize(`${prefix}${liText}`, printableWidthMm - 5);
            doc.text(bulletLines, marginMm + 4, currentY);
            currentY += bulletLines.length * 5.2 + 1.5;
            paragraphCount++;
          }
          currentY += 2;
        } else if (tagName === "table") {
          const rows = Array.from(el.querySelectorAll("tr"));
          for (const tr of rows) {
            const cells = Array.from(tr.querySelectorAll("th, td"));
            if (cells.length === 0) continue;
            ensureSpace(8);
            const colWidth = printableWidthMm / cells.length;
            doc.setFont("helvetica", tr.querySelector("th") ? "bold" : "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(30, 30, 30);

            let maxCellHeight = 6;
            for (let c = 0; c < cells.length; c++) {
              const cellText = cells[c].textContent?.trim() || "";
              const lines = doc.splitTextToSize(cellText, colWidth - 2);
              doc.text(lines, marginMm + c * colWidth + 1, currentY);
              maxCellHeight = Math.max(maxCellHeight, lines.length * 5);
            }
            currentY += maxCellHeight + 2;
          }
          currentY += 4;
          paragraphCount += rows.length;
        } else {
          // Standard Paragraph (<p> or generic block)
          ensureSpace(7);
          const isBold = el.querySelector("strong, b") !== null;
          const isItalic = el.querySelector("em, i") !== null;

          if (isBold && isItalic) doc.setFont("helvetica", "bolditalic");
          else if (isBold) doc.setFont("helvetica", "bold");
          else if (isItalic) doc.setFont("helvetica", "italic");
          else doc.setFont("helvetica", "normal");

          doc.setFontSize(11);
          doc.setTextColor(40, 40, 40);
          const lines = doc.splitTextToSize(textContent, printableWidthMm);
          doc.text(lines, marginMm, currentY);
          currentY += lines.length * 5.5 + 3.5;
          paragraphCount++;
        }
      }
    }
  }

  options.onProgress?.("Generating PDF...");

  const pdfArrayBuffer = doc.output("arraybuffer");
  const pdfBytes = new Uint8Array(pdfArrayBuffer);

  options.onProgress?.("Validating output...");

  if (!isValidPdfSignature(pdfBytes)) {
    throw new Error("Conversion failed: Output does not contain a valid %PDF- header.");
  }

  const outputBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
  const baseName = file.name.replace(/\.docx$/i, "");
  const filename = `${baseName}.pdf`;
  const pageCount = doc.getNumberOfPages();

  options.onProgress?.("Complete");

  const executionTimeMs = performance.now() - startTime;

  return {
    blob: outputBlob,
    filename,
    pageCount,
    originalSizeBytes: file.size,
    outputSizeBytes: outputBlob.size,
    executionTimeMs,
    paragraphCount,
  };
}
