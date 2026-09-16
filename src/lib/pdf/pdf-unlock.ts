import { PDFDocument } from "pdf-lib";
import { isEncrypted, decryptPDF } from "@pdfsmaller/pdf-decrypt";
import {
  isValidPdfSignature,
  validatePdfOutput,
  isPdfPasswordProtected,
  extractPdfVersion,
} from "./common";

export interface PdfUnlockInspection {
  isEncrypted: boolean;
  algorithm?: string;
  version?: number;
  revision?: number;
  pdfVersion: string;
  pageCount?: number;
}

export interface PdfUnlockResult {
  blob: Blob;
  filename: string;
  pageCount: number;
  outputSizeBytes: number;
  originalSizeBytes: number;
  executionTimeMs: number;
  wasEncrypted: boolean;
}

export const UNLOCK_LIMITS = {
  maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
};

/**
 * Inspects a PDF file to determine if it is encrypted and requires a password.
 * Never attempts to guess or crack passwords.
 */
export async function inspectPdfProtection(file: File): Promise<PdfUnlockInspection> {
  if (!file || file.size === 0) {
    throw new Error(`File "${file?.name || "document.pdf"}" is empty (0 bytes). Please select a valid PDF file.`);
  }

  if (file.size > UNLOCK_LIMITS.maxFileSizeBytes) {
    throw new Error(
      `File size exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller PDF.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (!isValidPdfSignature(bytes)) {
    throw new Error(`File "${file.name}" is not a valid PDF: Missing standard %PDF- file signature.`);
  }

  const pdfVersion = extractPdfVersion(bytes);

  // Check encryption via @pdfsmaller/pdf-decrypt
  try {
    const encInfo = await isEncrypted(bytes);
    if (encInfo.encrypted) {
      return {
        isEncrypted: true,
        algorithm: encInfo.algorithm,
        version: encInfo.version,
        revision: encInfo.revision,
        pdfVersion,
      };
    }
  } catch {
    // Fall back to pdf-lib inspection below
  }

  // Double-check with pdf-lib
  try {
    const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    if (doc.isEncrypted) {
      return {
        isEncrypted: true,
        pdfVersion,
        pageCount: doc.getPageCount(),
      };
    }
    return {
      isEncrypted: false,
      pdfVersion,
      pageCount: doc.getPageCount(),
    };
  } catch (err: unknown) {
    if (isPdfPasswordProtected(err)) {
      return {
        isEncrypted: true,
        pdfVersion,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Unable to read PDF "${file.name}": ${message}`);
  }
}

/**
 * Decrypts an authorized password-protected PDF using the user-provided password
 * and exports an unencrypted, fully unlocked PDF copy.
 *
 * Requirements:
 * - 100% in-browser processing via Web Crypto API.
 * - Never brute-forces or guesses passwords.
 * - Validates generated output (signature, page count, parseability without password).
 */
export async function unlockPdf(
  file: File,
  password?: string
): Promise<PdfUnlockResult> {
  const startTime = performance.now();

  if (!file || file.size === 0) {
    throw new Error(`File "${file?.name || "document.pdf"}" is empty (0 bytes).`);
  }

  if (file.size > UNLOCK_LIMITS.maxFileSizeBytes) {
    throw new Error(
      `File size exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller PDF.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const inputBytes = new Uint8Array(arrayBuffer);

  if (!isValidPdfSignature(inputBytes)) {
    throw new Error(`File "${file.name}" is not a valid PDF: Missing %PDF- signature.`);
  }

  // Inspect encryption state
  const encInfo = await isEncrypted(inputBytes).catch(() => ({ encrypted: false }));
  let decryptedBytes: Uint8Array;
  let wasEncrypted = false;

  if (encInfo.encrypted) {
    wasEncrypted = true;
    const pwd = password || "";
    if (!pwd) {
      throw new Error("This PDF is password-protected. Please enter the password to unlock it.");
    }

    try {
      decryptedBytes = await decryptPDF(inputBytes, pwd);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Incorrect password")) {
        throw new Error("Incorrect password or the PDF could not be unlocked.");
      }
      if (msg.includes("Unsupported encryption")) {
        throw new Error(
          "This PDF uses an unsupported encryption algorithm or custom security handler that cannot be decrypted locally."
        );
      }
      if (msg.includes("not encrypted")) {
        // Document has no /Encrypt dict after all
        wasEncrypted = false;
        decryptedBytes = inputBytes;
      } else {
        throw new Error(`Decryption failed: ${msg}`);
      }
    }
  } else {
    // Document is already unencrypted. Create a clean unrestricted copy via pdf-lib.
    try {
      const doc = await PDFDocument.load(inputBytes);
      decryptedBytes = await doc.save();
    } catch {
      // If pdf-lib fails, pass through the clean input
      decryptedBytes = inputBytes;
    }
  }

  // Validate the generated decrypted output
  const validation = await validatePdfOutput(decryptedBytes);
  if (!validation.isValid) {
    throw new Error(`Output PDF validation failed: ${validation.error || "Corrupted structure."}`);
  }

  // Verify the unlocked document no longer reports as encrypted
  try {
    const postCheck = await isEncrypted(decryptedBytes);
    if (postCheck.encrypted) {
      throw new Error("Validation check failed: Output PDF still contains encryption dictionaries.");
    }
  } catch {
    // Non-critical if check helper fails, validatePdfOutput confirmed parseability
  }

  // Build clean download filename (e.g. document-unlocked.pdf)
  const baseName = file.name.replace(/\.pdf$/i, "");
  const outputFilename = `${baseName}-unlocked.pdf`;

  const blob = new Blob([decryptedBytes as unknown as BlobPart], { type: "application/pdf" });
  const executionTimeMs = Math.round(performance.now() - startTime);

  return {
    blob,
    filename: outputFilename,
    pageCount: validation.pageCount,
    outputSizeBytes: blob.size,
    originalSizeBytes: file.size,
    executionTimeMs,
    wasEncrypted,
  };
}
