import { PDFDocument } from "pdf-lib";
import {
  isValidPdfSignature,
  validatePdfOutput,
  isPdfPasswordProtected,
  formatPdfError,
  getPdfDocumentInfo,
} from "./common";

export interface MergeSourceFileInfo {
  name: string;
  sizeBytes: number;
  pageCount: number;
}

export interface MergePdfOptions {
  outputFilename?: string;
  onProgress?: (stage: string) => void;
}

export interface MergePdfResult {
  blob: Blob;
  filename: string;
  fileCount: number;
  totalPageCount: number;
  outputSizeBytes: number;
  executionTimeMs: number;
  sourceFiles: MergeSourceFileInfo[];
}

export const MERGE_LIMITS = {
  maxFiles: 20,
  minFiles: 2,
  maxFileSizeBytes: 50 * 1024 * 1024, // 50MB per file
  maxTotalSizeBytes: 100 * 1024 * 1024, // 100MB aggregate
};

/**
 * Merges multiple PDF documents in the exact order provided.
 * Preserves page vector artwork, typography, dimensions, and rotation without rasterization.
 */
export async function mergePdfs(
  files: File[],
  options: MergePdfOptions = {}
): Promise<MergePdfResult> {
  const startTime = performance.now();

  // 1. Input Validation
  if (!files || files.length < MERGE_LIMITS.minFiles) {
    throw new Error(`Please select at least ${MERGE_LIMITS.minFiles} PDF files to merge.`);
  }

  if (files.length > MERGE_LIMITS.maxFiles) {
    throw new Error(
      `You can merge up to ${MERGE_LIMITS.maxFiles} files at once. You provided ${files.length}.`
    );
  }

  let aggregateSize = 0;
  for (const file of files) {
    if (file.size === 0) {
      throw new Error(`File "${file.name}" is empty (0 bytes) and cannot be merged.`);
    }
    if (file.size > MERGE_LIMITS.maxFileSizeBytes) {
      throw new Error(
        `File "${file.name}" exceeds the per-file limit of 50MB.`
      );
    }
    aggregateSize += file.size;
  }

  if (aggregateSize > MERGE_LIMITS.maxTotalSizeBytes) {
    throw new Error(
      `Total size of all selected PDFs exceeds the 100MB browser limit.`
    );
  }

  options.onProgress?.("Analyzing PDFs...");

  // 2. Pre-verify and inspect all source documents
  const sourceFiles: MergeSourceFileInfo[] = [];
  let expectedTotalPages = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    options.onProgress?.(`Analyzing document ${i + 1} of ${files.length}: ${file.name}...`);
    
    try {
      const info = await getPdfDocumentInfo(file);
      if (info.isEncrypted) {
        throw new Error(
          `"${file.name}" is password protected or cannot be opened. Please unlock it before merging.`
        );
      }
      sourceFiles.push({
        name: file.name,
        sizeBytes: file.size,
        pageCount: info.pageCount,
      });
      expectedTotalPages += info.pageCount;
    } catch (err) {
      throw new Error(formatPdfError(err, `Failed to analyze "${file.name}".`));
    }
  }

  // 3. Create master PDF and copy pages
  options.onProgress?.("Reading documents...");
  const mergedDoc = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    options.onProgress?.(`Merging pages from document ${i + 1} of ${files.length}: ${file.name}...`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      if (!isValidPdfSignature(bytes)) {
        throw new Error(`File "${file.name}" is missing a valid %PDF- signature.`);
      }

      let srcDoc: PDFDocument;
      try {
        srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      } catch (err) {
        if (isPdfPasswordProtected(err)) {
          throw new Error(`"${file.name}" is password protected and cannot be opened.`);
        }
        throw err;
      }

      if (srcDoc.isEncrypted) {
        throw new Error(`"${file.name}" is password protected and cannot be opened.`);
      }

      const pageIndices = srcDoc.getPageIndices();
      const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);

      for (const copiedPage of copiedPages) {
        mergedDoc.addPage(copiedPage);
      }
    } catch (err) {
      throw new Error(formatPdfError(err, `Failed to merge pages from "${file.name}".`));
    }
  }

  // 4. Generate serialized PDF
  options.onProgress?.("Generating PDF...");
  const mergedPdfBytes = await mergedDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  // 5. Output Verification
  options.onProgress?.("Validating output...");
  const validation = await validatePdfOutput(mergedPdfBytes, expectedTotalPages);
  if (!validation.isValid) {
    throw new Error(`Merged PDF verification failed: ${validation.error}`);
  }

  options.onProgress?.("Complete");

  // Build clean Blob from sliced buffer
  const safeBuffer = mergedPdfBytes.buffer.slice(
    mergedPdfBytes.byteOffset,
    mergedPdfBytes.byteOffset + mergedPdfBytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([safeBuffer], { type: "application/pdf" });

  let filename = (options.outputFilename || "merged.pdf").trim();
  if (!filename.toLowerCase().endsWith(".pdf")) {
    filename += ".pdf";
  }

  const executionTimeMs = performance.now() - startTime;

  return {
    blob,
    filename,
    fileCount: files.length,
    totalPageCount: expectedTotalPages,
    outputSizeBytes: blob.size,
    executionTimeMs,
    sourceFiles,
  };
}
