import { PDFDocument } from "pdf-lib";
import {
  isValidPdfSignature,
  validatePdfOutput,
  isPdfPasswordProtected,
  formatPdfError,
  getPdfDocumentInfo,
} from "./common";

export type SplitMode = "selected" | "ranges" | "every";

export interface ParsedRangeGroup {
  originalToken: string;
  normalizedRange: string;
  pageNumbers: number[]; // 1-indexed
  pageIndices: number[]; // 0-indexed for pdf-lib
}

export interface RangeParseResult {
  isValid: boolean;
  groups: ParsedRangeGroup[];
  allPageNumbers: number[]; // deduplicated union
  error?: string;
}

export interface SplitPdfConfig {
  mode: SplitMode;
  selectedPages?: number[]; // for 'selected' mode (1-indexed)
  rangeString?: string; // for 'ranges' mode
}

export interface GeneratedPdfFile {
  filename: string;
  blob: Blob;
  pageCount: number;
  sizeBytes: number;
}

export interface SplitPdfResult {
  isArchive: boolean; // true if ZIP, false if single PDF
  blob: Blob;
  filename: string;
  fileCount: number;
  totalOriginalPages: number;
  outputSizeBytes: number;
  executionTimeMs: number;
  files: GeneratedPdfFile[];
}

export const SPLIT_LIMITS = {
  maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
};

/**
 * Parses and validates a page range expression (e.g., "1-3, 5, 8-10").
 * Rules:
 * - 1-indexed page numbers.
 * - Handles arbitrary whitespace (" 1 - 3 , 5 ").
 * - Normalizes reversed ranges like "3-1" into [1, 2, 3] with informative tracking.
 * - Rejects 0, negative numbers, non-numeric characters, and out-of-bound pages.
 * - Each comma-separated segment represents a separate output document group.
 */
export function parsePageRanges(rangeStr: string, totalPages: number): RangeParseResult {
  const trimmed = rangeStr.trim();
  if (!trimmed) {
    return {
      isValid: false,
      groups: [],
      allPageNumbers: [],
      error: "Please enter at least one page number or range (e.g. 1-3, 5).",
    };
  }

  // Split by comma
  const rawTokens = trimmed.split(",");
  const groups: ParsedRangeGroup[] = [];
  const allPagesSet = new Set<number>();

  for (const rawToken of rawTokens) {
    const token = rawToken.trim();
    if (!token) {
      return {
        isValid: false,
        groups: [],
        allPageNumbers: [],
        error: "Invalid range syntax: Empty segment found between commas.",
      };
    }

    if (token.includes("-")) {
      const parts = token.split("-");
      if (parts.length !== 2) {
        return {
          isValid: false,
          groups: [],
          allPageNumbers: [],
          error: `Invalid range format "${token}". Expected format like "1-5".`,
        };
      }

      const startStr = parts[0].trim();
      const endStr = parts[1].trim();

      if (!/^\d+$/.test(startStr) || !/^\d+$/.test(endStr)) {
        return {
          isValid: false,
          groups: [],
          allPageNumbers: [],
          error: `Non-numeric page reference in range "${token}".`,
        };
      }

      let start = parseInt(startStr, 10);
      let end = parseInt(endStr, 10);

      if (start < 1 || end < 1) {
        return {
          isValid: false,
          groups: [],
          allPageNumbers: [],
          error: `Page numbers must be 1 or greater (found in "${token}").`,
        };
      }

      if (start > totalPages || end > totalPages) {
        return {
          isValid: false,
          groups: [],
          allPageNumbers: [],
          error: `Page number in "${token}" exceeds document total (${totalPages} pages).`,
        };
      }

      // If reversed (e.g. 3-1), normalize to 1-3
      if (start > end) {
        const temp = start;
        start = end;
        end = temp;
      }

      const pageNumbers: number[] = [];
      const pageIndices: number[] = [];
      for (let p = start; p <= end; p++) {
        pageNumbers.push(p);
        pageIndices.push(p - 1);
        allPagesSet.add(p);
      }

      groups.push({
        originalToken: token,
        normalizedRange: `${start}-${end}`,
        pageNumbers,
        pageIndices,
      });
    } else {
      // Single page token
      if (!/^\d+$/.test(token)) {
        return {
          isValid: false,
          groups: [],
          allPageNumbers: [],
          error: `Invalid page number "${token}". Only numbers and hyphens are accepted.`,
        };
      }

      const page = parseInt(token, 10);
      if (page < 1) {
        return {
          isValid: false,
          groups: [],
          allPageNumbers: [],
          error: `Page number "${page}" is invalid. Document pages begin at 1.`,
        };
      }

      if (page > totalPages) {
        return {
          isValid: false,
          groups: [],
          allPageNumbers: [],
          error: `Page ${page} exceeds document total (${totalPages} pages).`,
        };
      }

      allPagesSet.add(page);
      groups.push({
        originalToken: token,
        normalizedRange: `${page}`,
        pageNumbers: [page],
        pageIndices: [page - 1],
      });
    }
  }

  const allPageNumbers = Array.from(allPagesSet).sort((a, b) => a - b);

  return {
    isValid: true,
    groups,
    allPageNumbers,
  };
}

export interface SplitPdfOptions {
  onProgress?: (stage: string) => void;
}

/**
 * Splits a PDF according to the chosen configuration:
 * 1. "selected": Outputs a single PDF containing only user-selected pages.
 * 2. "ranges": Outputs separate PDFs for each specified range (bundled into ZIP if >1).
 * 3. "every": Outputs each page as an independent PDF bundled into a ZIP.
 */
export async function splitPdf(
  file: File,
  config: SplitPdfConfig,
  options: SplitPdfOptions = {}
): Promise<SplitPdfResult> {
  const startTime = performance.now();

  // 1. Initial Validation
  if (!file || file.size === 0) {
    throw new Error("Please select a valid, non-empty PDF file to split.");
  }

  if (file.size > SPLIT_LIMITS.maxFileSizeBytes) {
    throw new Error("Selected PDF exceeds the maximum allowed size of 50MB.");
  }

  options.onProgress?.("Reading PDF...");

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (!isValidPdfSignature(bytes)) {
    throw new Error("Invalid PDF file: Missing standard %PDF- header signature.");
  }

  // Check document info and encryption
  const docInfo = await getPdfDocumentInfo(file);
  if (docInfo.isEncrypted) {
    throw new Error(
      "This PDF is password protected or cannot be opened. Please remove encryption before splitting."
    );
  }

  const totalOriginalPages = docInfo.pageCount;
  if (totalOriginalPages === 0) {
    throw new Error("This PDF document contains 0 pages.");
  }

  let srcDoc: PDFDocument;
  try {
    srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  } catch (err) {
    if (isPdfPasswordProtected(err)) {
      throw new Error("This PDF is password protected or cannot be opened.");
    }
    throw new Error(formatPdfError(err, "Failed to parse PDF document."));
  }

  options.onProgress?.("Preparing pages...");

  // Determine groups of pages to output
  const baseName = file.name.replace(/\.pdf$/i, "");
  interface PlanItem {
    filename: string;
    pageIndices: number[];
  }

  const plans: PlanItem[] = [];

  if (config.mode === "selected") {
    const selected = (config.selectedPages || []).filter(
      (p) => p >= 1 && p <= totalOriginalPages
    );

    if (selected.length === 0) {
      throw new Error("Please select at least one page to extract.");
    }

    // Sort selected pages in numerical order and deduplicate
    const uniqueSorted = Array.from(new Set(selected)).sort((a, b) => a - b);
    const indices = uniqueSorted.map((p) => p - 1);

    const suffix =
      uniqueSorted.length <= 3
        ? `pages-${uniqueSorted.join("-")}`
        : `selected-${uniqueSorted.length}-pages`;

    plans.push({
      filename: `${baseName}-${suffix}.pdf`,
      pageIndices: indices,
    });
  } else if (config.mode === "ranges") {
    const rangeResult = parsePageRanges(config.rangeString || "", totalOriginalPages);
    if (!rangeResult.isValid) {
      throw new Error(rangeResult.error || "Invalid page range specified.");
    }

    for (const group of rangeResult.groups) {
      const isSingle = group.pageIndices.length === 1;
      const filename = isSingle
        ? `${baseName}-page-${group.pageNumbers[0]}.pdf`
        : `${baseName}-pages-${group.normalizedRange}.pdf`;

      plans.push({
        filename,
        pageIndices: group.pageIndices,
      });
    }
  } else if (config.mode === "every") {
    for (let p = 1; p <= totalOriginalPages; p++) {
      plans.push({
        filename: `${baseName}-page-${p}.pdf`,
        pageIndices: [p - 1],
      });
    }
  } else {
    throw new Error("Unsupported split mode.");
  }

  if (plans.length === 0) {
    throw new Error("No output documents configured.");
  }

  options.onProgress?.("Creating split documents...");

  // 3. Generate each PDF document
  const generatedFiles: GeneratedPdfFile[] = [];

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    options.onProgress?.(`Generating document ${i + 1} of ${plans.length}: ${plan.filename}...`);

    const splitDoc = await PDFDocument.create();
    const copiedPages = await splitDoc.copyPages(srcDoc, plan.pageIndices);

    for (const page of copiedPages) {
      splitDoc.addPage(page);
    }

    const pdfBytes = await splitDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    // Validate generated document
    const validation = await validatePdfOutput(pdfBytes, plan.pageIndices.length);
    if (!validation.isValid) {
      throw new Error(`Validation failed for "${plan.filename}": ${validation.error}`);
    }

    const safeBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([safeBuffer], { type: "application/pdf" });

    generatedFiles.push({
      filename: plan.filename,
      blob,
      pageCount: plan.pageIndices.length,
      sizeBytes: blob.size,
    });
  }

  // 4. Multi-Output packaging: Single PDF or ZIP Archive
  let finalBlob: Blob;
  let finalFilename: string;
  const isArchive = generatedFiles.length > 1;

  if (!isArchive) {
    // Single PDF file output
    finalBlob = generatedFiles[0].blob;
    finalFilename = generatedFiles[0].filename;
  } else {
    // Multiple PDFs: Dynamically load JSZip to build archive
    options.onProgress?.("Creating ZIP archive...");

    try {
      const jszipModule = await import("jszip");
      const JSZip = jszipModule.default || jszipModule;
      const zip = new JSZip();

      for (const fileItem of generatedFiles) {
        zip.file(fileItem.filename, fileItem.blob);
      }

      options.onProgress?.("Finalizing ZIP archive...");
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      if (zipBlob.size === 0) {
        throw new Error("Generated ZIP archive is empty.");
      }

      finalBlob = zipBlob;
      finalFilename = `${baseName}-split.zip`;
    } catch (zipErr) {
      const msg = zipErr instanceof Error ? zipErr.message : String(zipErr);
      throw new Error(`Failed to generate ZIP archive: ${msg}`);
    }
  }

  options.onProgress?.("Validating output...");
  options.onProgress?.("Complete");

  const executionTimeMs = performance.now() - startTime;

  return {
    isArchive,
    blob: finalBlob,
    filename: finalFilename,
    fileCount: generatedFiles.length,
    totalOriginalPages,
    outputSizeBytes: finalBlob.size,
    executionTimeMs,
    files: generatedFiles,
  };
}
