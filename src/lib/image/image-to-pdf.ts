import { ToolProcessingError } from "@/lib/workspace/errors";
import { getImageMetadata } from "./resize-image";

export type PdfPageSize = "a4" | "a5" | "letter" | "legal" | "original";
export type PdfOrientation = "auto" | "portrait" | "landscape";
export type PdfImageFit = "contain" | "cover" | "original";
export type PdfMargin = "none" | "small" | "medium" | "large";

export interface PdfPageSizeDimensions {
  widthMm: number;
  heightMm: number;
  label: string;
}

export const PAGE_SIZE_DIMENSIONS: Record<Exclude<PdfPageSize, "original">, PdfPageSizeDimensions> = {
  a4: { widthMm: 210, heightMm: 297, label: "A4 (210 × 297 mm)" },
  a5: { widthMm: 148, heightMm: 210, label: "A5 (148 × 210 mm)" },
  letter: { widthMm: 215.9, heightMm: 279.4, label: "US Letter (8.5 × 11 in)" },
  legal: { widthMm: 215.9, heightMm: 355.6, label: "US Legal (8.5 × 14 in)" },
};

export const MARGIN_VALUES: Record<PdfMargin, { mm: number; label: string }> = {
  none: { mm: 0, label: "None (0 mm)" },
  small: { mm: 10, label: "Small (10 mm)" },
  medium: { mm: 20, label: "Medium (20 mm)" },
  large: { mm: 30, label: "Large (30 mm)" },
};

export interface PdfImageItem {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

export interface ImageToPdfOptions {
  pageSize?: PdfPageSize;
  orientation?: PdfOrientation;
  fit?: PdfImageFit;
  margin?: PdfMargin;
  imageQuality?: number; // 0.1 to 1.0 (default 0.92)
}

export interface ImageToPdfResult {
  blob: Blob;
  pageCount: number;
  size: number;
  processingTimeMs: number;
}

/**
 * Converts pixels to mm at 96 DPI (standard web screen ratio).
 */
const PX_TO_MM = 25.4 / 96;

/**
 * Prepares a PdfImageItem from a File, extracting dimensions and creating a preview URL.
 */
export async function createPdfImageItem(
  file: File,
  createUrl: (file: File) => string
): Promise<PdfImageItem> {
  const metadata = await getImageMetadata(file);
  const previewUrl = createUrl(file);

  return {
    id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    file,
    previewUrl,
    width: metadata.width,
    height: metadata.height,
    size: file.size,
    format: metadata.format,
  };
}

/**
 * Converts an array of image items into a multi-page PDF document client-side using jsPDF.
 */
export async function convertImagesToPdf(
  items: PdfImageItem[],
  options: ImageToPdfOptions = {}
): Promise<ImageToPdfResult> {
  const startTime = performance.now();

  if (!items || items.length === 0) {
    throw new ToolProcessingError("EMPTY_INPUT", "Please provide at least one image to create a PDF.");
  }

  if (typeof window === "undefined") {
    throw new ToolProcessingError("UNSUPPORTED_OPERATION", "Browser environment required for PDF creation.");
  }

  const {
    pageSize = "a4",
    orientation = "auto",
    fit = "contain",
    margin = "small",
    imageQuality = 0.92,
  } = options;

  const marginMm = MARGIN_VALUES[margin].mm;

  // Dynamically load jsPDF
  let jsPDFClass: typeof import("jspdf").jsPDF;
  try {
    const jspdfModule = await import("jspdf");
    jsPDFClass = jspdfModule.jsPDF;
  } catch (err) {
    throw new ToolProcessingError(
      "PROCESSING_FAILED",
      "Failed to load PDF generation library. Please refresh and try again.",
      err
    );
  }

  let doc: import("jspdf").jsPDF | null = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 1. Determine orientation for this page
    let pageOrientation: "portrait" | "landscape" = "portrait";
    if (orientation === "auto") {
      pageOrientation = item.width > item.height ? "landscape" : "portrait";
    } else {
      pageOrientation = orientation;
    }

    // 2. Determine page dimensions in mm
    let pageWidthMm: number;
    let pageHeightMm: number;

    if (pageSize === "original") {
      pageWidthMm = item.width * PX_TO_MM + marginMm * 2;
      pageHeightMm = item.height * PX_TO_MM + marginMm * 2;
    } else {
      const baseDim = PAGE_SIZE_DIMENSIONS[pageSize];
      if (pageOrientation === "landscape") {
        pageWidthMm = Math.max(baseDim.widthMm, baseDim.heightMm);
        pageHeightMm = Math.min(baseDim.widthMm, baseDim.heightMm);
      } else {
        pageWidthMm = Math.min(baseDim.widthMm, baseDim.heightMm);
        pageHeightMm = Math.max(baseDim.widthMm, baseDim.heightMm);
      }
    }

    // Initialize document or add page
    if (!doc) {
      doc = new jsPDFClass({
        orientation: pageOrientation,
        unit: "mm",
        format: [pageWidthMm, pageHeightMm],
        compress: true,
      });
    } else {
      doc.addPage([pageWidthMm, pageHeightMm], pageOrientation);
    }

    // 3. Calculate printable area
    const availWidthMm = Math.max(1, pageWidthMm - marginMm * 2);
    const availHeightMm = Math.max(1, pageHeightMm - marginMm * 2);

    const imgWidthMm = item.width * PX_TO_MM;
    const imgHeightMm = item.height * PX_TO_MM;

    let targetWidthMm: number;
    let targetHeightMm: number;

    if (fit === "contain") {
      // Scale to fit within printable bounds without exceeding either dimension
      const widthRatio = availWidthMm / imgWidthMm;
      const heightRatio = availHeightMm / imgHeightMm;
      const scale = Math.min(widthRatio, heightRatio);

      targetWidthMm = imgWidthMm * scale;
      targetHeightMm = imgHeightMm * scale;
    } else if (fit === "cover") {
      // Scale to fill the printable area, matching larger dimension
      const widthRatio = availWidthMm / imgWidthMm;
      const heightRatio = availHeightMm / imgHeightMm;
      const scale = Math.max(widthRatio, heightRatio);

      targetWidthMm = imgWidthMm * scale;
      targetHeightMm = imgHeightMm * scale;
    } else {
      // Original size (capped at available page boundaries)
      if (imgWidthMm <= availWidthMm && imgHeightMm <= availHeightMm) {
        targetWidthMm = imgWidthMm;
        targetHeightMm = imgHeightMm;
      } else {
        const scale = Math.min(availWidthMm / imgWidthMm, availHeightMm / imgHeightMm);
        targetWidthMm = imgWidthMm * scale;
        targetHeightMm = imgHeightMm * scale;
      }
    }

    // Center image within available area
    const posX = marginMm + (availWidthMm - targetWidthMm) / 2;
    const posY = marginMm + (availHeightMm - targetHeightMm) / 2;

    // 4. Render image onto a white-backed canvas to handle transparency cleanly
    const imgDataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(item.file);

      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new ToolProcessingError("PROCESSING_FAILED", "Could not initialize canvas context."));
            return;
          }

          // Composite white background to avoid dark artifacts for transparent PNG/WebP
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          const data = canvas.toDataURL("image/jpeg", imageQuality);
          resolve(data);
        } catch (err) {
          reject(new ToolProcessingError("PROCESSING_FAILED", "Failed rendering image frame for PDF.", err));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new ToolProcessingError("CORRUPTED_FILE", `Failed loading image "${item.file.name}".`));
      };

      img.src = objUrl;
    });

    // Add image to PDF page
    doc.addImage(imgDataUrl, "JPEG", posX, posY, targetWidthMm, targetHeightMm, undefined, "FAST");
  }

  if (!doc) {
    throw new ToolProcessingError("PROCESSING_FAILED", "Failed to construct PDF document.");
  }

  const pdfBlob = doc.output("blob");
  const endTime = performance.now();

  return {
    blob: pdfBlob,
    pageCount: items.length,
    size: pdfBlob.size,
    processingTimeMs: Math.round(endTime - startTime),
  };
}
