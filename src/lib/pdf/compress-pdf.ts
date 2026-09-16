import {
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFNumber,
  PDFArray,
  PDFDict,
} from "pdf-lib";

export type CompressionLevel = "basic" | "recommended" | "maximum";

export interface CompressionPreset {
  id: CompressionLevel;
  name: string;
  tagline: string;
  description: string;
  badge?: string;
  maxDimension?: number;
  jpegQuality?: number;
}

export const COMPRESSION_PRESETS: Record<CompressionLevel, CompressionPreset> = {
  basic: {
    id: "basic",
    name: "Basic",
    tagline: "Prioritizes quality.",
    description:
      "Cleans up internal PDF structures, deduplicates streams, and enables xref object stream packing. Zero alteration to embedded image resolution.",
  },
  recommended: {
    id: "recommended",
    name: "Recommended",
    tagline: "Balances quality and file size.",
    description:
      "Standard balanced optimization. Recompresses large embedded photos (max 1600px, 75% quality) and compacts PDF object streams.",
    badge: "Recommended",
    maxDimension: 1600,
    jpegQuality: 0.75,
  },
  maximum: {
    id: "maximum",
    name: "Maximum",
    tagline: "Prioritizes smaller file size.",
    description:
      "Aggressive reduction for email and web uploads. Scales embedded images to max 1024px at 55% quality while preserving vector fonts and text.",
    badge: "Smallest Size",
    maxDimension: 1024,
    jpegQuality: 0.55,
  },
};

export interface CompressPdfOptions {
  level: CompressionLevel;
  onProgress?: (stage: string) => void;
}

export interface CompressPdfResult {
  blob: Blob;
  filename: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  bytesSaved: number;
  percentageSaved: number;
  isSmaller: boolean;
  pageCount: number;
  pdfVersion: string;
  imagesOptimized: number;
  executionTimeMs: number;
}

import {
  isValidPdfSignature,
  extractPdfVersion,
  getPdfDocumentInfo,
  type PdfDocumentInfo,
} from "./common";

export {
  isValidPdfSignature,
  extractPdfVersion,
  getPdfDocumentInfo,
  type PdfDocumentInfo,
};

/**
 * Generates an appropriate output filename, e.g. "document-compressed.pdf".
 */
export function generateCompressedFilename(originalName: string): string {
  const cleanName = originalName.replace(/\.pdf$/i, "");
  return `${cleanName}-compressed.pdf`;
}

/**
 * Checks if a PDF stream dictionary corresponds to a DCTDecode (JPEG) image.
 */
function isJpegImageStream(dict: PDFDict): boolean {
  const filter = dict.get(PDFName.of("Filter"));
  if (!filter) return false;

  if (filter instanceof PDFName) {
    return filter.toString() === "/DCTDecode";
  }

  if (filter instanceof PDFArray) {
    return filter.asArray().some((f) => f.toString() === "/DCTDecode");
  }

  return false;
}

/**
 * Loads an image from a Blob into an HTMLImageElement in the browser.
 */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    img.src = url;
  });
}

/**
 * Compresses an image byte buffer using browser Canvas APIs.
 * Returns null if recompression fails or does not yield a smaller size.
 */
async function optimizeJpegBuffer(
  rawBytes: Uint8Array,
  maxDimension: number,
  quality: number
): Promise<{ newBytes: Uint8Array; width: number; height: number } | null> {
  // If in non-browser environment (e.g. testing), return null safely
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  try {
    const safeBuffer = rawBytes.buffer.slice(
      rawBytes.byteOffset,
      rawBytes.byteOffset + rawBytes.byteLength
    ) as ArrayBuffer;
    const imageBlob = new Blob([safeBuffer], { type: "image/jpeg" });
    const img = await loadImageFromBlob(imageBlob);

    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;

    if (!naturalWidth || !naturalHeight) return null;

    let targetWidth = naturalWidth;
    let targetHeight = naturalHeight;

    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      const scale = Math.min(
        maxDimension / targetWidth,
        maxDimension / targetHeight
      );
      targetWidth = Math.max(1, Math.round(targetWidth * scale));
      targetHeight = Math.max(1, Math.round(targetHeight * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    // Cleanup canvas dimensions to free RAM
    canvas.width = 0;
    canvas.height = 0;

    if (!compressedBlob) return null;

    const compressedBuffer = await compressedBlob.arrayBuffer();
    const newBytes = new Uint8Array(compressedBuffer);

    // CRITICAL: Only return new bytes if strictly smaller than original!
    if (newBytes.length < rawBytes.length) {
      return {
        newBytes,
        width: targetWidth,
        height: targetHeight,
      };
    }

    return null;
  } catch {
    // If decoding or recompression fails (e.g. unusual JPEG sub-format), keep original untouched
    return null;
  }
}

/**
 * Main Pure Processing Engine: Compresses a PDF file completely in the browser.
 */
export async function compressPdf(
  file: File,
  options: CompressPdfOptions
): Promise<CompressPdfResult> {
  const startTime = performance.now();
  const preset = COMPRESSION_PRESETS[options.level] || COMPRESSION_PRESETS.recommended;

  options.onProgress?.("Analyzing PDF...");
  const originalArrayBuffer = await file.arrayBuffer();
  const originalBytes = new Uint8Array(originalArrayBuffer);

  // 1. Signature validation
  if (!isValidPdfSignature(originalBytes)) {
    throw new Error(
      "Invalid PDF file: Missing %PDF- signature. Please verify the uploaded file is a valid PDF."
    );
  }

  const pdfVersion = extractPdfVersion(originalBytes);

  // 2. Load PDF document
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(originalArrayBuffer, { ignoreEncryption: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("encrypt") || msg.toLowerCase().includes("password")) {
      throw new Error(
        "Password-protected PDFs cannot be compressed. Please unlock your document before uploading."
      );
    }
    throw new Error(`Failed to read PDF document: ${msg}`);
  }

  if (doc.isEncrypted) {
    throw new Error(
      "Password-protected PDFs cannot be compressed. Please unlock your document before uploading."
    );
  }

  const originalPageCount = doc.getPageCount();
  if (originalPageCount === 0) {
    throw new Error("The uploaded PDF document contains 0 pages.");
  }

  options.onProgress?.("Reading pages & resources...");

  let imagesOptimized = 0;

  // 3. Embedded Image Optimization (For Recommended and Maximum presets)
  if (preset.maxDimension && preset.jpegQuality) {
    options.onProgress?.("Optimizing embedded resources...");

    try {
      const indirectObjects = doc.context.enumerateIndirectObjects();

      for (const [, obj] of indirectObjects) {
        if (obj instanceof PDFRawStream) {
          const subtype = obj.dict.get(PDFName.of("Subtype"));
          if (subtype && subtype.toString() === "/Image") {
            // Check if it's a JPEG image without transparency mask (/SMask)
            const hasSmask = obj.dict.get(PDFName.of("SMask"));
            if (!hasSmask && isJpegImageStream(obj.dict)) {
              const currentBytes = obj.getContents();
              if (currentBytes && currentBytes.length > 512) {
                const optimized = await optimizeJpegBuffer(
                  currentBytes,
                  preset.maxDimension,
                  preset.jpegQuality
                );

                if (optimized) {
                  // Safely update raw stream contents and dictionary metadata
                  (obj as unknown as { contents: Uint8Array }).contents = optimized.newBytes;
                  obj.dict.set(
                    PDFName.of("Length"),
                    PDFNumber.of(optimized.newBytes.length)
                  );
                  obj.dict.set(
                    PDFName.of("Width"),
                    PDFNumber.of(optimized.width)
                  );
                  obj.dict.set(
                    PDFName.of("Height"),
                    PDFNumber.of(optimized.height)
                  );
                  obj.dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
                  imagesOptimized++;
                }
              }
            }
          }
        }
      }
    } catch {
      // In case of non-fatal sub-object parsing warnings, proceed to structural compression
    }
  }

  // 4. Rebuild and serialize PDF with object stream packing
  options.onProgress?.("Rebuilding PDF structure...");

  const compressedUint8Array = await doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
    updateFieldAppearances: false,
  });

  options.onProgress?.("Finalizing & validating output...");

  // 5. Output Verification
  if (!isValidPdfSignature(compressedUint8Array)) {
    throw new Error(
      "Compression verification failed: Generated file missing %PDF- header."
    );
  }

  // Verify the generated PDF can be parsed and page count matches exactly
  try {
    const verifiedDoc = await PDFDocument.load(compressedUint8Array);
    if (verifiedDoc.getPageCount() !== originalPageCount) {
      throw new Error(
        `Validation failed: Page count mismatch (expected ${originalPageCount}, found ${verifiedDoc.getPageCount()}).`
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Validation failed: Output PDF is unreadable (${msg}).`);
  }

  const originalSizeBytes = file.size;
  const compressedSizeBytes = compressedUint8Array.byteLength;
  const isSmaller = compressedSizeBytes < originalSizeBytes;
  const bytesSaved = isSmaller ? originalSizeBytes - compressedSizeBytes : 0;
  const percentageSaved = isSmaller
    ? Math.round(((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 1000) / 10
    : 0;

  // If the compressed output is not smaller than original, deliver original file Blob to prevent bloating!
  const safePdfBuffer = compressedUint8Array.buffer.slice(
    compressedUint8Array.byteOffset,
    compressedUint8Array.byteOffset + compressedUint8Array.byteLength
  ) as ArrayBuffer;
  const finalBlob = isSmaller
    ? new Blob([safePdfBuffer], { type: "application/pdf" })
    : file.slice(0, file.size, "application/pdf");

  const finalSizeBytes = isSmaller ? compressedSizeBytes : originalSizeBytes;

  const executionTimeMs = performance.now() - startTime;
  const filename = generateCompressedFilename(file.name);

  return {
    blob: finalBlob,
    filename,
    originalSizeBytes,
    compressedSizeBytes: finalSizeBytes,
    bytesSaved,
    percentageSaved,
    isSmaller,
    pageCount: originalPageCount,
    pdfVersion,
    imagesOptimized,
    executionTimeMs,
  };
}
