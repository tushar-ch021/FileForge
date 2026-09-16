import { parsePageRanges } from "./split-pdf";
import { isValidPdfSignature, isPdfPasswordProtected } from "./common";

export type JpgQualityLevel = "standard" | "high" | "maximum";
export type JpgScaleLevel = "1x" | "1.5x" | "2x" | "3x";
export type PdfToJpgPageMode = "all" | "selected" | "ranges";

export interface PdfToJpgOptions {
  mode: PdfToJpgPageMode;
  selectedPages?: number[];
  rangeString?: string;
  quality?: JpgQualityLevel;
  scale?: JpgScaleLevel;
  onProgress?: (stage: string) => void;
}

export interface RenderedJpgItem {
  pageNumber: number;
  filename: string;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface PdfToJpgResult {
  isArchive: boolean;
  blob: Blob;
  filename: string;
  pageCount: number;
  totalOriginalPages: number;
  outputSizeBytes: number;
  executionTimeMs: number;
  images: RenderedJpgItem[];
}

export const QUALITY_VALUES: Record<JpgQualityLevel, { quality: number; label: string }> = {
  standard: { quality: 0.8, label: "Standard (80% Quality)" },
  high: { quality: 0.92, label: "High (92% Quality)" },
  maximum: { quality: 0.98, label: "Maximum (98% Quality)" },
};

export const SCALE_VALUES: Record<JpgScaleLevel, { scale: number; label: string; dpiEstimate: string }> = {
  "1x": { scale: 1.0, label: "1× Standard", dpiEstimate: "~72 DPI" },
  "1.5x": { scale: 1.5, label: "1.5× Sharp", dpiEstimate: "~108 DPI" },
  "2x": { scale: 2.0, label: "2× High Res", dpiEstimate: "~144 DPI" },
  "3x": { scale: 3.0, label: "3× Ultra Crisp", dpiEstimate: "~216 DPI" },
};

/**
 * Initializes and configures the local PDF.js worker.
 * Uses strictly local /pdf.worker.min.mjs without any external CDN dependency.
 */
async function getPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    // Strictly local origin worker
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjs;
}

/**
 * Renders pages from an authentic PDF file to JPG images in the browser.
 */
export async function convertPdfToJpg(
  file: File,
  options: PdfToJpgOptions
): Promise<PdfToJpgResult> {
  const startTime = performance.now();

  if (!file || file.size === 0) {
    throw new Error("Please upload a valid, non-empty PDF file.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (!isValidPdfSignature(bytes)) {
    throw new Error("Invalid PDF document: Missing standard %PDF- file signature.");
  }

  options.onProgress?.("Reading PDF...");

  const pdfjs = await getPdfJs();

  let loadingTask;
  let pdfDoc;
  try {
    loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      // Suppress console spam for minor font warnings
      isEvalSupported: false,
    });
    pdfDoc = await loadingTask.promise;
  } catch (err: unknown) {
    if (isPdfPasswordProtected(err)) {
      throw new Error("This PDF is password protected or cannot be opened. Please unlock it first.");
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Unable to load PDF: ${msg}`);
  }

  const totalOriginalPages = pdfDoc.numPages;
  if (totalOriginalPages === 0) {
    throw new Error("The uploaded PDF has 0 pages.");
  }

  // Determine pages to render
  let targetPages: number[] = [];

  if (options.mode === "all") {
    for (let p = 1; p <= totalOriginalPages; p++) targetPages.push(p);
  } else if (options.mode === "selected") {
    const selected = (options.selectedPages || []).filter(
      (p) => p >= 1 && p <= totalOriginalPages
    );
    if (selected.length === 0) {
      throw new Error("Please select at least one page to convert.");
    }
    targetPages = Array.from(new Set(selected)).sort((a, b) => a - b);
  } else if (options.mode === "ranges") {
    const parsed = parsePageRanges(options.rangeString || "", totalOriginalPages);
    if (!parsed.isValid) {
      throw new Error(parsed.error || "Invalid page range expression.");
    }
    targetPages = parsed.allPageNumbers;
  }

  if (targetPages.length === 0) {
    throw new Error("No pages selected for conversion.");
  }

  const quality = QUALITY_VALUES[options.quality || "high"].quality;
  const scale = SCALE_VALUES[options.scale || "2x"].scale;
  const baseName = file.name.replace(/\.pdf$/i, "");

  const renderedImages: RenderedJpgItem[] = [];

  // Sequential rendering to prevent browser memory spikes
  for (let i = 0; i < targetPages.length; i++) {
    const pageNum = targetPages[i];
    options.onProgress?.(`Rendering page ${i + 1} of ${targetPages.length} (Page ${pageNum})...`);

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("Browser Canvas 2D context could not be initialized.");
    }

    // JPEG has no alpha channel: Fill pure white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render PDF page to canvas
    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    // Convert canvas to JPEG Blob
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Failed to generate image for page ${pageNum}.`));
        },
        "image/jpeg",
        quality
      );
    });

    const previewUrl = URL.createObjectURL(blob);
    const filename = `${baseName}-page-${pageNum}.jpg`;

    renderedImages.push({
      pageNumber: pageNum,
      filename,
      blob,
      previewUrl,
      width: canvas.width,
      height: canvas.height,
      sizeBytes: blob.size,
    });

    // Clean canvas memory
    canvas.width = 0;
    canvas.height = 0;
  }

  options.onProgress?.("Packaging output...");

  let finalBlob: Blob;
  let finalFilename: string;
  const isArchive = renderedImages.length > 1;

  if (!isArchive) {
    finalBlob = renderedImages[0].blob;
    finalFilename = renderedImages[0].filename;
  } else {
    options.onProgress?.("Creating ZIP archive...");
    const jszipModule = await import("jszip");
    const JSZip = jszipModule.default || jszipModule;
    const zip = new JSZip();

    for (const img of renderedImages) {
      zip.file(img.filename, img.blob);
    }

    finalBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    finalFilename = `${baseName}-jpg.zip`;
  }

  options.onProgress?.("Complete");

  const executionTimeMs = performance.now() - startTime;

  return {
    isArchive,
    blob: finalBlob,
    filename: finalFilename,
    pageCount: renderedImages.length,
    totalOriginalPages,
    outputSizeBytes: finalBlob.size,
    executionTimeMs,
    images: renderedImages,
  };
}
