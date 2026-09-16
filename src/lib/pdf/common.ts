import {
  PDFDocument,
  PDFName,
  PDFRawStream,
} from "pdf-lib";

export interface PdfDocumentInfo {
  filename: string;
  sizeBytes: number;
  pageCount: number;
  pdfVersion: string;
  imageCount: number;
  isEncrypted: boolean;
}

/**
 * Checks whether the byte sequence starts with or contains the standard PDF magic signature (%PDF-).
 */
export function isValidPdfSignature(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 5) return false;
  // Look for %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D) within the first 1024 bytes
  const limit = Math.min(bytes.length - 4, 1024);
  for (let i = 0; i < limit; i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts PDF specification version from header bytes (e.g. "%PDF-1.7" -> "PDF 1.7").
 */
export function extractPdfVersion(bytes: Uint8Array): string {
  try {
    const header = new TextDecoder("latin1").decode(bytes.subarray(0, 32));
    const match = header.match(/%PDF-(\d+\.\d+)/);
    if (match) {
      return `PDF ${match[1]}`;
    }
  } catch {
    // Ignore decoding error
  }
  return "PDF 1.5+";
}

/**
 * Detects whether an error or PDFDocument indicates password protection / encryption.
 */
export function isPdfPasswordProtected(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  return (
    lower.includes("encrypt") ||
    lower.includes("password") ||
    lower.includes("security handler") ||
    lower.includes("cannot be opened")
  );
}

/**
 * Human-friendly error message formatter for PDF operations.
 */
export function formatPdfError(err: unknown, defaultMessage = "Failed to process PDF document."): string {
  if (isPdfPasswordProtected(err)) {
    return "This PDF is password protected or cannot be opened. Please remove encryption before processing.";
  }
  if (err instanceof Error) {
    if (err.message.includes("Invalid PDF file") || err.message.includes("Missing standard %PDF-")) {
      return err.message;
    }
    return `PDF Error: ${err.message}`;
  }
  return defaultMessage;
}

/**
 * Inspects a PDF file and extracts document metadata (page count, version, image count, encryption status).
 */
export async function getPdfDocumentInfo(file: File): Promise<PdfDocumentInfo> {
  if (file.size === 0) {
    throw new Error(`File "${file.name}" is empty (0 bytes). Please select a valid PDF file.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (!isValidPdfSignature(bytes)) {
    throw new Error(
      `File "${file.name}" is not a valid PDF: Missing standard %PDF- file signature.`
    );
  }

  const pdfVersion = extractPdfVersion(bytes);

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  } catch (err: unknown) {
    if (isPdfPasswordProtected(err)) {
      return {
        filename: file.name,
        sizeBytes: file.size,
        pageCount: 0,
        pdfVersion,
        imageCount: 0,
        isEncrypted: true,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Unable to parse PDF "${file.name}": ${message}`);
  }

  if (doc.isEncrypted) {
    return {
      filename: file.name,
      sizeBytes: file.size,
      pageCount: doc.getPageCount(),
      pdfVersion,
      imageCount: 0,
      isEncrypted: true,
    };
  }

  const pageCount = doc.getPageCount();

  // Count embedded raster images if possible
  let imageCount = 0;
  try {
    const indirectObjects = doc.context.enumerateIndirectObjects();
    for (const [, obj] of indirectObjects) {
      if (obj instanceof PDFRawStream) {
        const subtype = obj.dict.get(PDFName.of("Subtype"));
        if (subtype && subtype.toString() === "/Image") {
          imageCount++;
        }
      }
    }
  } catch {
    // Non-critical image count
  }

  return {
    filename: file.name,
    sizeBytes: file.size,
    pageCount,
    pdfVersion,
    imageCount,
    isEncrypted: false,
  };
}

/**
 * Validates a generated PDF byte array:
 * 1. Checks non-empty length.
 * 2. Checks %PDF- signature.
 * 3. Confirms document can be parsed again by PDFDocument.load.
 * 4. Checks that page count matches expected count if provided.
 */
export async function validatePdfOutput(
  bytes: Uint8Array,
  expectedPageCount?: number
): Promise<{ isValid: boolean; pageCount: number; error?: string }> {
  if (!bytes || bytes.length === 0) {
    return { isValid: false, pageCount: 0, error: "Output PDF is empty (0 bytes)." };
  }

  if (!isValidPdfSignature(bytes)) {
    return { isValid: false, pageCount: 0, error: "Output PDF is missing valid %PDF- header signature." };
  }

  try {
    const doc = await PDFDocument.load(bytes);
    const pageCount = doc.getPageCount();

    if (expectedPageCount !== undefined && pageCount !== expectedPageCount) {
      return {
        isValid: false,
        pageCount,
        error: `Page count mismatch: expected ${expectedPageCount} pages, but generated document has ${pageCount} pages.`,
      };
    }

    return { isValid: true, pageCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { isValid: false, pageCount: 0, error: `Output PDF cannot be parsed: ${msg}` };
  }
}
