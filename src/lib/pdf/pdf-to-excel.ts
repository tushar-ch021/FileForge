import * as pdfjs from "pdfjs-dist";
import { isValidPdfSignature, isPdfPasswordProtected } from "./common";
import { parsePageRanges } from "./split-pdf";

// Ensure local PDF.js worker is configured
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export interface PdfToExcelConfig {
  scope: "all" | "selected" | "ranges";
  selectedPages?: number[];
  rangeString?: string;
}

export interface DetectedCell {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isBold?: boolean;
}

export interface DetectedTable {
  pageNumber: number;
  tableIndex: number;
  sheetName: string;
  headers: string[];
  rows: (string | number)[][];
  columnWidths: number[];
}

export interface PdfToExcelResult {
  blob: Blob;
  filename: string;
  pagesProcessed: number;
  tablesDetected: number;
  rowsExtracted: number;
  sheetsCreated: number;
  outputSizeBytes: number;
  executionTimeMs: number;
  scannedPagesDetected: number;
  warnings: string[];
}

export const EXCEL_LIMITS = {
  maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
};

/**
 * Excel sheet names are restricted to 31 characters and cannot contain:
 * \ / ? * [ ] :
 */
export function sanitizeSheetName(name: string, existingNames: Set<string>): string {
  let clean = name.replace(/[\\/?*[\]:]/g, " ").trim();
  if (clean.length > 31) {
    clean = clean.substring(0, 31).trim();
  }
  if (!clean) {
    clean = "Sheet";
  }

  let finalName = clean;
  let counter = 1;
  while (existingNames.has(finalName.toLowerCase())) {
    const suffix = ` (${counter})`;
    const maxBaseLen = 31 - suffix.length;
    finalName = `${clean.substring(0, maxBaseLen)}${suffix}`;
    counter++;
  }

  existingNames.add(finalName.toLowerCase());
  return finalName;
}

/**
 * Determines whether a cell string should be formatted as an Excel Number
 * without mangling account numbers, postal codes, or phone numbers.
 */
export function parseCellValue(val: string): { value: string | number; type: typeof Number | typeof String } {
  const trimmed = val.trim();
  if (!trimmed) {
    return { value: "", type: String };
  }

  // Preserve leading zeros for codes/IDs (e.g. "01234")
  if (trimmed.length > 1 && trimmed.startsWith("0") && !trimmed.startsWith("0.")) {
    return { value: trimmed, type: String };
  }

  // Check if pure integer or float
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isNaN(num) && Math.abs(num) < Number.MAX_SAFE_INTEGER) {
      return { value: num, type: Number };
    }
  }

  return { value: trimmed, type: String };
}

/**
 * Extracts tabular data from a PDF page using coordinate-based clustering.
 */
function extractTablesFromPageItems(
  items: DetectedCell[],
  pageNumber: number
): DetectedTable[] {
  if (items.length === 0) return [];

  // Group items by baseline Y coordinate (tolerance ~3.5pt)
  const lineTolerance = 3.5;
  const lines: { y: number; cells: DetectedCell[] }[] = [];

  // Sort items from top of page to bottom (PDF Y is bottom-to-top, so higher Y is top)
  const sortedItems = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  for (const item of sortedItems) {
    let matchedLine = lines.find((l) => Math.abs(l.y - item.y) <= lineTolerance);
    if (!matchedLine) {
      matchedLine = { y: item.y, cells: [] };
      lines.push(matchedLine);
    }
    matchedLine.cells.push(item);
  }

  // Sort each line's cells left-to-right by X
  for (const line of lines) {
    line.cells.sort((a, b) => a.x - b.x);
  }

  // Filter out lines that are single words or page headers/footers
  // Look for lines with >= 2 distinct columns
  const tableCandidates: { y: number; cells: DetectedCell[] }[][] = [];
  let currentGroup: { y: number; cells: DetectedCell[] }[] = [];

  for (const line of lines) {
    // If a line has 2 or more cells or sufficient width spread
    if (line.cells.length >= 2) {
      currentGroup.push(line);
    } else {
      if (currentGroup.length >= 2) {
        tableCandidates.push(currentGroup);
      }
      currentGroup = [];
    }
  }
  if (currentGroup.length >= 2) {
    tableCandidates.push(currentGroup);
  }

  // If no multi-cell lines found, check if lines can be split by larger X gaps
  if (tableCandidates.length === 0 && lines.length >= 2) {
    // Treat entire page lines as a single table candidate
    tableCandidates.push(lines);
  }

  const detectedTables: DetectedTable[] = [];
  let tableIdx = 1;

  for (const group of tableCandidates) {
    if (group.length < 2) continue;

    // Detect column boundaries across all lines in this group
    const allXCoordinates: number[] = [];
    for (const line of group) {
      for (const cell of line.cells) {
        allXCoordinates.push(cell.x);
      }
    }
    allXCoordinates.sort((a, b) => a - b);

    // Cluster X coordinates into distinct columns (tolerance 15pt)
    const colTolerance = 15;
    const colCenters: number[] = [];
    for (const x of allXCoordinates) {
      const match = colCenters.find((c) => Math.abs(c - x) <= colTolerance);
      if (match === undefined) {
        colCenters.push(x);
      }
    }
    colCenters.sort((a, b) => a - b);

    if (colCenters.length < 1) continue;

    // Build 2D matrix of rows
    const matrix: (string | number)[][] = [];
    const maxCharsPerCol = new Array(colCenters.length).fill(8);

    for (const line of group) {
      const rowData: (string | number)[] = new Array(colCenters.length).fill("");

      for (const cell of line.cells) {
        // Find closest column center
        let closestCol = 0;
        let minDist = Number.POSITIVE_INFINITY;
        for (let c = 0; c < colCenters.length; c++) {
          const dist = Math.abs(colCenters[c] - cell.x);
          if (dist < minDist) {
            minDist = dist;
            closestCol = c;
          }
        }

        const parsed = parseCellValue(cell.text);
        if (rowData[closestCol] === "") {
          rowData[closestCol] = parsed.value;
        } else {
          // Merge text if multiple runs belong to same column
          rowData[closestCol] = `${rowData[closestCol]} ${parsed.value}`.trim();
        }

        const cellLen = String(rowData[closestCol]).length;
        if (cellLen > maxCharsPerCol[closestCol]) {
          maxCharsPerCol[closestCol] = Math.min(50, cellLen);
        }
      }

      // Only add non-empty rows
      if (rowData.some((c) => c !== "")) {
        matrix.push(rowData);
      }
    }

    if (matrix.length > 0) {
      const headerRow = matrix[0].map((c) => String(c));
      const bodyRows = matrix.slice(1);

      detectedTables.push({
        pageNumber,
        tableIndex: tableIdx,
        sheetName: `Page ${pageNumber} Table ${tableIdx}`,
        headers: headerRow,
        rows: bodyRows.length > 0 ? bodyRows : [headerRow],
        columnWidths: maxCharsPerCol.map((c) => Math.max(12, c + 3)),
      });
      tableIdx++;
    }
  }

  return detectedTables;
}

/**
 * Converts a PDF into an Excel workbook (.xlsx) containing detected tables.
 */
export async function convertPdfToExcel(
  file: File,
  config: PdfToExcelConfig = { scope: "all" }
): Promise<PdfToExcelResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  if (!file || file.size === 0) {
    throw new Error(`File "${file?.name || "document.pdf"}" is empty (0 bytes).`);
  }

  if (file.size > EXCEL_LIMITS.maxFileSizeBytes) {
    throw new Error(
      `File size exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller PDF.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (!isValidPdfSignature(bytes)) {
    throw new Error(`File "${file.name}" is not a valid PDF: Missing %PDF- signature.`);
  }

  // Load document with pdfjs-dist
  let pdfDoc: pdfjs.PDFDocumentProxy;
  try {
    const loadingTask = pdfjs.getDocument({
      data: bytes,
      standardFontDataUrl: undefined,
    });
    pdfDoc = await loadingTask.promise;
  } catch (err: unknown) {
    if (isPdfPasswordProtected(err)) {
      throw new Error("This PDF is password protected. Please unlock it using the Unlock PDF tool before converting to Excel.");
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load PDF: ${message}`);
  }

  const totalPages = pdfDoc.numPages;

  // Determine target pages based on scope config
  let targetPages: number[] = [];
  if (config.scope === "selected" && config.selectedPages && config.selectedPages.length > 0) {
    targetPages = config.selectedPages.filter((p) => p >= 1 && p <= totalPages);
  } else if (config.scope === "ranges" && config.rangeString) {
    const parsed = parsePageRanges(config.rangeString, totalPages);
    if (!parsed.isValid) {
      throw new Error(parsed.error || "Invalid page range syntax.");
    }
    targetPages = parsed.allPageNumbers;
  } else {
    // Default: all pages
    targetPages = Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (targetPages.length === 0) {
    throw new Error("No valid pages selected for extraction.");
  }

  let scannedPagesCount = 0;
  const allDetectedTables: DetectedTable[] = [];

  // Sequential processing loop to conserve memory
  for (const pageNum of targetPages) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    let totalChars = 0;
    const items: DetectedCell[] = [];

    for (const rawItem of textContent.items) {
      if ("str" in rawItem) {
        const item = rawItem as {
          str: string;
          transform: number[];
          width: number;
          height: number;
          fontName?: string;
        };

        const text = item.str.trim();
        if (text) {
          totalChars += text.length;
          items.push({
            text,
            x: Math.round(item.transform[4] * 10) / 10,
            y: Math.round(item.transform[5] * 10) / 10,
            width: item.width,
            height: item.height,
            isBold: item.fontName ? item.fontName.toLowerCase().includes("bold") : false,
          });
        }
      }
    }

    // Scanned page check: if < 10 characters extracted, page is likely image-only
    if (totalChars < 10) {
      scannedPagesCount++;
    } else {
      const pageTables = extractTablesFromPageItems(items, pageNum);
      allDetectedTables.push(...pageTables);
    }

    // Free page memory
    page.cleanup();
  }

  if (scannedPagesCount === targetPages.length) {
    warnings.push(
      "This PDF appears to contain scanned or image-based pages without digital text. Table extraction is not available without OCR."
    );
  }

  if (allDetectedTables.length === 0) {
    if (scannedPagesCount > 0) {
      throw new Error(
        "This PDF appears to contain scanned/image-based pages. Table extraction is not available without OCR."
      );
    }
    throw new Error(
      "No structured tabular data could be reliably detected on the selected pages. Results depend on the PDF's layout structure."
    );
  }

  // Build Excel Workbook sheets structure for write-excel-file
  // Dynamically import write-excel-file for client-side bundle efficiency
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  const existingSheetNames = new Set<string>();
  const sheetsPayload = allDetectedTables.map((tbl) => {
    const sheetName = sanitizeSheetName(tbl.sheetName, existingSheetNames);

    // Header row with bold styling
    const headerRow = tbl.headers.map((h) => ({
      value: h,
      fontWeight: "bold" as const,
      type: String,
    }));

    // Data rows
    const bodyRows = tbl.rows.map((row) =>
      row.map((cell) => {
        const parsed = parseCellValue(String(cell));
        return {
          value: parsed.value,
          type: parsed.type,
        };
      })
    );

    const sheetData = [headerRow, ...bodyRows];
    const columns = tbl.columnWidths.map((w) => ({ width: w }));

    return {
      data: sheetData,
      sheet: sheetName,
      columns,
    };
  });

  // Generate Excel workbook Blob
  const excelWriter = writeXlsxFile(sheetsPayload);
  const blob = await excelWriter.toBlob();

  // Validate generated XLSX package
  if (!blob || blob.size === 0) {
    throw new Error("Failed to generate Excel workbook: Output file is empty.");
  }

  const baseName = file.name.replace(/\.pdf$/i, "");
  const outputFilename = `${baseName}.xlsx`;
  const executionTimeMs = Math.round(performance.now() - startTime);

  const totalRows = allDetectedTables.reduce(
    (acc, t) => acc + t.rows.length + 1, // +1 for header
    0
  );

  return {
    blob,
    filename: outputFilename,
    pagesProcessed: targetPages.length,
    tablesDetected: allDetectedTables.length,
    rowsExtracted: totalRows,
    sheetsCreated: sheetsPayload.length,
    outputSizeBytes: blob.size,
    executionTimeMs,
    scannedPagesDetected: scannedPagesCount,
    warnings,
  };
}
