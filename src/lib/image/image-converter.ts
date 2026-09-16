import { ToolProcessingError } from "@/lib/workspace/errors";
import {
  SupportedImageFormat,
  detectImageFormat,
  getImageMetadata,
  ImageMetadata,
} from "./resize-image";

export type ConvertFormat = SupportedImageFormat;

export interface FormatDetails {
  format: ConvertFormat;
  label: string;
  extension: string;
  mimeType: string;
  supportsTransparency: boolean;
  supportsQuality: boolean;
  description: string;
}

export const CONVERT_FORMATS: FormatDetails[] = [
  {
    format: "image/jpeg",
    label: "JPG / JPEG",
    extension: "jpg",
    mimeType: "image/jpeg",
    supportsTransparency: false,
    supportsQuality: true,
    description: "Standard photo format with lossy compression (no transparency)",
  },
  {
    format: "image/png",
    label: "PNG",
    extension: "png",
    mimeType: "image/png",
    supportsTransparency: true,
    supportsQuality: false,
    description: "Lossless compression with full alpha transparency",
  },
  {
    format: "image/webp",
    label: "WebP",
    extension: "webp",
    mimeType: "image/webp",
    supportsTransparency: true,
    supportsQuality: true,
    description: "Modern high-efficiency format with both lossy compression and alpha support",
  },
];

export interface ConvertImageOptions {
  targetFormat: ConvertFormat;
  quality?: number; // 1 - 100 for lossy formats (JPEG, WebP)
  backgroundColor?: string; // Fallback background for transparent graphics when converting to JPEG
}

export interface ConvertImageResult {
  blob: Blob;
  width: number;
  height: number;
  sourceFormat: ConvertFormat;
  targetFormat: ConvertFormat;
  extension: string;
  sizeBytes: number;
  originalSizeBytes: number;
  bytesSaved: number;
  percentageSaved: number;
  isSmaller: boolean;
  executionTimeMs: number;
}

/**
 * Converts an image file to another format in-browser while strictly preserving dimensions.
 */
export async function convertImage(
  file: File,
  options: ConvertImageOptions
): Promise<ConvertImageResult> {
  const startTime = performance.now();

  if (typeof window === "undefined") {
    throw new ToolProcessingError(
      "UNSUPPORTED_OPERATION",
      "Image conversion must run in the browser."
    );
  }

  if (file.size <= 0) {
    throw new ToolProcessingError("EMPTY_INPUT", "The selected file is empty (0 bytes).");
  }

  const sourceFormat = detectImageFormat(file);
  const targetFormat = options.targetFormat;

  const targetConfig = CONVERT_FORMATS.find((f) => f.format === targetFormat);
  if (!targetConfig) {
    throw new ToolProcessingError(
      "UNSUPPORTED_OPERATION",
      `Unsupported target format: "${targetFormat}".`
    );
  }

  // Decode source image
  let imageSource: ImageBitmap | HTMLImageElement;
  let width = 0;
  let height = 0;

  try {
    if (typeof window.createImageBitmap === "function") {
      imageSource = await window.createImageBitmap(file);
      width = imageSource.width;
      height = imageSource.height;
    } else {
      imageSource = await new Promise<HTMLImageElement>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load image element"));
        };
        img.src = url;
      });
      width = imageSource.naturalWidth || imageSource.width;
      height = imageSource.naturalHeight || imageSource.height;
    }
  } catch (err) {
    throw new ToolProcessingError(
      "CORRUPTED_FILE",
      "Failed to read image for conversion. The file may be corrupt or not a valid image.",
      err
    );
  }

  if (width <= 0 || height <= 0) {
    if ("close" in imageSource && typeof imageSource.close === "function") {
      imageSource.close();
    }
    throw new ToolProcessingError("CORRUPTED_FILE", "Invalid image dimensions decoded.");
  }

  let blob: Blob;

  try {
    const isOffscreenSupported =
      typeof OffscreenCanvas !== "undefined" &&
      typeof OffscreenCanvas.prototype.convertToBlob === "function";

    // Normalize quality between 0.01 and 1.0 (Canvas standard)
    const rawQuality = options.quality ?? 80;
    const normalizedQuality = Math.max(0.01, Math.min(1.0, rawQuality / 100));

    if (isOffscreenSupported) {
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to get 2D context for OffscreenCanvas.");
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // If output is JPEG, fill background with solid color (JPEG has no alpha channel)
      if (targetFormat === "image/jpeg") {
        ctx.fillStyle = options.backgroundColor || "#ffffff";
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.clearRect(0, 0, width, height);
      }

      ctx.drawImage(imageSource, 0, 0, width, height);

      blob = await offscreen.convertToBlob({
        type: targetFormat,
        quality: targetConfig.supportsQuality ? normalizedQuality : undefined,
      });
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to get 2D context for Canvas.");
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // If output is JPEG, fill background with solid color
      if (targetFormat === "image/jpeg") {
        ctx.fillStyle = options.backgroundColor || "#ffffff";
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.clearRect(0, 0, width, height);
      }

      ctx.drawImage(imageSource, 0, 0, width, height);

      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error("Canvas toBlob returned null."));
            }
          },
          targetFormat,
          targetConfig.supportsQuality ? normalizedQuality : undefined
        );
      });
    }
  } catch (err) {
    throw new ToolProcessingError(
      "PROCESSING_FAILED",
      "An error occurred while converting the image format.",
      err
    );
  } finally {
    if ("close" in imageSource && typeof imageSource.close === "function") {
      imageSource.close();
    }
  }

  const executionTimeMs = performance.now() - startTime;
  const originalSizeBytes = file.size;
  const sizeBytes = blob.size;
  const bytesSaved = originalSizeBytes - sizeBytes;
  const isSmaller = bytesSaved > 0;
  const percentageSaved = isSmaller
    ? Math.round((bytesSaved / originalSizeBytes) * 100)
    : 0;

  return {
    blob,
    width,
    height,
    sourceFormat,
    targetFormat,
    extension: targetConfig.extension,
    sizeBytes,
    originalSizeBytes,
    bytesSaved,
    percentageSaved,
    isSmaller,
    executionTimeMs,
  };
}

/**
 * Generates an output filename for converted image without overwriting.
 */
export function generateConvertedFilename(
  originalFilename: string,
  extension: string
): string {
  const lastDotIndex = originalFilename.lastIndexOf(".");
  const baseName =
    lastDotIndex > 0 ? originalFilename.slice(0, lastDotIndex) : originalFilename;
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return `${safeBaseName || "image"}.${extension}`;
}

export { detectImageFormat, getImageMetadata, type ImageMetadata };
