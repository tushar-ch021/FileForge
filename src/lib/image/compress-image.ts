import { ToolProcessingError } from "@/lib/workspace/errors";
import {
  SupportedImageFormat,
  detectImageFormat,
  getImageMetadata,
  ImageMetadata,
} from "./resize-image";

export type CompressibleFormat = SupportedImageFormat;
export type OutputFormatOption = "original" | CompressibleFormat;

export interface CompressionPreset {
  id: "high" | "balanced" | "strong" | "custom";
  label: string;
  description: string;
  quality: number;
}

export const COMPRESSION_PRESETS: CompressionPreset[] = [
  {
    id: "high",
    label: "High Quality",
    description: "Subtle compression with near-lossless clarity",
    quality: 90,
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Recommended sweet spot of quality & size reduction",
    quality: 80,
  },
  {
    id: "strong",
    label: "Strong Compression",
    description: "Aggressive reduction for maximum space savings",
    quality: 60,
  },
];

export interface CompressImageOptions {
  quality: number; // 1 - 100
  outputFormat?: OutputFormatOption;
  backgroundColor?: string; // Fallback background for transparent source when saving as JPEG
}

export interface CompressImageResult {
  blob: Blob;
  width: number;
  height: number;
  format: CompressibleFormat;
  extension: string;
  sizeBytes: number;
  originalSizeBytes: number;
  bytesSaved: number;
  percentageSaved: number;
  isSmaller: boolean;
  executionTimeMs: number;
}

/**
 * Compresses an image file in-browser using Canvas / OffscreenCanvas encoding,
 * maintaining source dimensions while optimizing compression quality.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions
): Promise<CompressImageResult> {
  const startTime = performance.now();

  if (typeof window === "undefined") {
    throw new ToolProcessingError(
      "UNSUPPORTED_OPERATION",
      "Image compression must run in the browser."
    );
  }

  if (file.size <= 0) {
    throw new ToolProcessingError("EMPTY_INPUT", "The selected file is empty (0 bytes).");
  }

  const sourceFormat = detectImageFormat(file);
  const targetFormat: CompressibleFormat =
    !options.outputFormat || options.outputFormat === "original"
      ? sourceFormat
      : options.outputFormat;

  const extensionMap: Record<CompressibleFormat, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensionMap[targetFormat] || "jpg";

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
      "Failed to read image for compression. The file may be corrupt or not a valid image.",
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

    // PNG does not support quality parameter in browser Canvas API
    const supportsQuality = targetFormat === "image/jpeg" || targetFormat === "image/webp";

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
        quality: supportsQuality ? normalizedQuality : undefined,
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
          supportsQuality ? normalizedQuality : undefined
        );
      });
    }
  } catch (err) {
    throw new ToolProcessingError(
      "PROCESSING_FAILED",
      "An error occurred while compressing the image. Please try a different quality or format.",
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
    format: targetFormat,
    extension,
    sizeBytes,
    originalSizeBytes,
    bytesSaved,
    percentageSaved,
    isSmaller,
    executionTimeMs,
  };
}

/**
 * Generates an output filename for compressed image without overwriting.
 */
export function generateCompressedFilename(
  originalFilename: string,
  extension: string
): string {
  const lastDotIndex = originalFilename.lastIndexOf(".");
  const baseName =
    lastDotIndex > 0 ? originalFilename.slice(0, lastDotIndex) : originalFilename;
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return `${safeBaseName || "image"}-compressed.${extension}`;
}

export { detectImageFormat, getImageMetadata, type ImageMetadata };
