import { ToolProcessingError } from "@/lib/workspace/errors";
import {
  SupportedImageFormat,
  detectImageFormat,
  getImageMetadata,
  ImageMetadata,
} from "./resize-image";

export type CropFormat = SupportedImageFormat;

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AspectRatioOption {
  id: string;
  label: string;
  ratio: number | null; // null for "Free"
  description: string;
}

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: "free", label: "Freeform", ratio: null, description: "Unconstrained width & height" },
  { id: "1:1", label: "1:1", ratio: 1, description: "Square (Profile, Instagram)" },
  { id: "4:3", label: "4:3", ratio: 4 / 3, description: "Standard photo & display" },
  { id: "16:9", label: "16:9", ratio: 16 / 9, description: "Widescreen (YouTube, Video)" },
  { id: "3:2", label: "3:2", ratio: 3 / 2, description: "Classic 35mm photography" },
];

export interface CropImageOptions {
  cropRect: CropRect;
  rotation?: number; // 0, 90, 180, 270 degrees
  outputFormat?: "original" | CropFormat;
  quality?: number; // 1 - 100 for lossy formats (JPEG, WebP)
  backgroundColor?: string; // Fallback background for transparent graphics when saving as JPEG
}

export interface CropImageResult {
  blob: Blob;
  width: number;
  height: number;
  format: CropFormat;
  extension: string;
  sizeBytes: number;
  originalSizeBytes: number;
  originalWidth: number;
  originalHeight: number;
  executionTimeMs: number;
}

/**
 * Validates and clamps crop rectangle inside image bounds.
 */
export function clampCropRect(
  rect: CropRect,
  boundsWidth: number,
  boundsHeight: number,
  minDimension = 10
): CropRect {
  const width = Math.max(minDimension, Math.min(Math.round(rect.width), boundsWidth));
  const height = Math.max(minDimension, Math.min(Math.round(rect.height), boundsHeight));

  const x = Math.max(0, Math.min(Math.round(rect.x), boundsWidth - width));
  const y = Math.max(0, Math.min(Math.round(rect.y), boundsHeight - height));

  return { x, y, width, height };
}

/**
 * Calculates a centered crop rectangle for a given aspect ratio within image bounds.
 */
export function calculateInitialCropRect(
  imageWidth: number,
  imageHeight: number,
  targetRatio: number | null,
  coverageFraction = 0.8
): CropRect {
  if (!targetRatio || targetRatio <= 0) {
    const width = Math.round(imageWidth * coverageFraction);
    const height = Math.round(imageHeight * coverageFraction);
    const x = Math.round((imageWidth - width) / 2);
    const y = Math.round((imageHeight - height) / 2);
    return clampCropRect({ x, y, width, height }, imageWidth, imageHeight);
  }

  let width = imageWidth * coverageFraction;
  let height = width / targetRatio;

  if (height > imageHeight * coverageFraction) {
    height = imageHeight * coverageFraction;
    width = height * targetRatio;
  }

  width = Math.round(width);
  height = Math.round(height);
  const x = Math.round((imageWidth - width) / 2);
  const y = Math.round((imageHeight - height) / 2);

  return clampCropRect({ x, y, width, height }, imageWidth, imageHeight);
}

/**
 * Crops an image in-browser with optional 90° rotation, aspect ratio compliance, and format encoding.
 */
export async function cropImage(
  file: File,
  options: CropImageOptions
): Promise<CropImageResult> {
  const startTime = performance.now();

  if (typeof window === "undefined") {
    throw new ToolProcessingError(
      "UNSUPPORTED_OPERATION",
      "Image cropping must run in the browser."
    );
  }

  if (file.size <= 0) {
    throw new ToolProcessingError("EMPTY_INPUT", "The selected file is empty (0 bytes).");
  }

  const sourceFormat = detectImageFormat(file);
  const targetFormat: CropFormat =
    !options.outputFormat || options.outputFormat === "original"
      ? sourceFormat
      : options.outputFormat;

  const extensionMap: Record<CropFormat, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensionMap[targetFormat] || "jpg";

  // 1. Decode source image
  let imageSource: ImageBitmap | HTMLImageElement;
  let originalWidth = 0;
  let originalHeight = 0;

  try {
    if (typeof window.createImageBitmap === "function") {
      imageSource = await window.createImageBitmap(file);
      originalWidth = imageSource.width;
      originalHeight = imageSource.height;
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
      originalWidth = imageSource.naturalWidth || imageSource.width;
      originalHeight = imageSource.naturalHeight || imageSource.height;
    }
  } catch (err) {
    throw new ToolProcessingError(
      "CORRUPTED_FILE",
      "Failed to read image for cropping. The file may be corrupt or not a valid image.",
      err
    );
  }

  if (originalWidth <= 0 || originalHeight <= 0) {
    if ("close" in imageSource && typeof imageSource.close === "function") {
      imageSource.close();
    }
    throw new ToolProcessingError("CORRUPTED_FILE", "Invalid image dimensions decoded.");
  }

  // 2. Handle Rotation if applied
  const rotationDegrees = ((options.rotation || 0) % 360 + 360) % 360;
  let currentWidth = originalWidth;
  let currentHeight = originalHeight;
  let rotatedCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;

  if (rotationDegrees !== 0) {
    const isSwapped = rotationDegrees === 90 || rotationDegrees === 270;
    const rotW = isSwapped ? originalHeight : originalWidth;
    const rotH = isSwapped ? originalWidth : originalHeight;

    if (typeof OffscreenCanvas !== "undefined") {
      const off = new OffscreenCanvas(rotW, rotH);
      const ctx = off.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.translate(rotW / 2, rotH / 2);
        ctx.rotate((rotationDegrees * Math.PI) / 180);
        ctx.drawImage(imageSource, -originalWidth / 2, -originalHeight / 2);
        rotatedCanvas = off;
      }
    }

    if (!rotatedCanvas) {
      const canv = document.createElement("canvas");
      canv.width = rotW;
      canv.height = rotH;
      const ctx = canv.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context for rotation");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.translate(rotW / 2, rotH / 2);
      ctx.rotate((rotationDegrees * Math.PI) / 180);
      ctx.drawImage(imageSource, -originalWidth / 2, -originalHeight / 2);
      rotatedCanvas = canv;
    }

    currentWidth = rotW;
    currentHeight = rotH;
  }

  // 3. Clamp Crop Rect
  const safeCrop = clampCropRect(options.cropRect, currentWidth, currentHeight);
  if (safeCrop.width <= 0 || safeCrop.height <= 0) {
    if ("close" in imageSource && typeof imageSource.close === "function") {
      imageSource.close();
    }
    throw new ToolProcessingError(
      "PROCESSING_FAILED",
      "Invalid crop dimensions. Width and height must be positive numbers."
    );
  }

  // 4. Render Cropped Region to Output Canvas
  const sourceToDraw = rotatedCanvas || imageSource;
  let blob: Blob;

  try {
    const isOffscreenSupported =
      typeof OffscreenCanvas !== "undefined" &&
      typeof OffscreenCanvas.prototype.convertToBlob === "function";

    const rawQuality = options.quality ?? 80;
    const normalizedQuality = Math.max(0.01, Math.min(1.0, rawQuality / 100));
    const supportsQuality = targetFormat === "image/jpeg" || targetFormat === "image/webp";

    if (isOffscreenSupported) {
      const offscreen = new OffscreenCanvas(safeCrop.width, safeCrop.height);
      const ctx = offscreen.getContext("2d");
      if (!ctx) throw new Error("Unable to create 2D context for cropping.");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (targetFormat === "image/jpeg") {
        ctx.fillStyle = options.backgroundColor || "#ffffff";
        ctx.fillRect(0, 0, safeCrop.width, safeCrop.height);
      } else {
        ctx.clearRect(0, 0, safeCrop.width, safeCrop.height);
      }

      ctx.drawImage(
        sourceToDraw,
        safeCrop.x,
        safeCrop.y,
        safeCrop.width,
        safeCrop.height,
        0,
        0,
        safeCrop.width,
        safeCrop.height
      );

      blob = await offscreen.convertToBlob({
        type: targetFormat,
        quality: supportsQuality ? normalizedQuality : undefined,
      });
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = safeCrop.width;
      canvas.height = safeCrop.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Unable to create canvas context for cropping.");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (targetFormat === "image/jpeg") {
        ctx.fillStyle = options.backgroundColor || "#ffffff";
        ctx.fillRect(0, 0, safeCrop.width, safeCrop.height);
      } else {
        ctx.clearRect(0, 0, safeCrop.width, safeCrop.height);
      }

      ctx.drawImage(
        sourceToDraw,
        safeCrop.x,
        safeCrop.y,
        safeCrop.width,
        safeCrop.height,
        0,
        0,
        safeCrop.width,
        safeCrop.height
      );

      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error("Canvas toBlob failed during crop."));
          },
          targetFormat,
          supportsQuality ? normalizedQuality : undefined
        );
      });
    }
  } catch (err) {
    throw new ToolProcessingError(
      "PROCESSING_FAILED",
      "An error occurred while cropping the image. Please try adjusting your crop selection.",
      err
    );
  } finally {
    if ("close" in imageSource && typeof imageSource.close === "function") {
      imageSource.close();
    }
  }

  const executionTimeMs = performance.now() - startTime;

  return {
    blob,
    width: safeCrop.width,
    height: safeCrop.height,
    format: targetFormat,
    extension,
    sizeBytes: blob.size,
    originalSizeBytes: file.size,
    originalWidth,
    originalHeight,
    executionTimeMs,
  };
}

/**
 * Generates an output filename for the cropped image without overwriting.
 */
export function generateCroppedFilename(
  originalFilename: string,
  extension: string
): string {
  const lastDotIndex = originalFilename.lastIndexOf(".");
  const baseName =
    lastDotIndex > 0 ? originalFilename.slice(0, lastDotIndex) : originalFilename;
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return `${safeBaseName || "image"}-cropped.${extension}`;
}

export { detectImageFormat, getImageMetadata, type ImageMetadata };
