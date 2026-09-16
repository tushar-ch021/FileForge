import { ToolProcessingError } from "@/lib/workspace/errors";

export type SupportedImageFormat = "image/jpeg" | "image/png" | "image/webp";

export const SUPPORTED_IMAGE_FORMATS: {
  format: SupportedImageFormat;
  label: string;
  extension: string;
  supportsTransparency: boolean;
  supportsQuality: boolean;
}[] = [
  {
    format: "image/jpeg",
    label: "JPG / JPEG",
    extension: "jpg",
    supportsTransparency: false,
    supportsQuality: true,
  },
  {
    format: "image/png",
    label: "PNG",
    extension: "png",
    supportsTransparency: true,
    supportsQuality: false,
  },
  {
    format: "image/webp",
    label: "WebP",
    extension: "webp",
    supportsTransparency: true,
    supportsQuality: true,
  },
];

export const MAX_SAFE_DIMENSION = 16384; // Max width or height in px
export const MAX_SAFE_AREA = 100_000_000; // 100 Megapixels

export interface ImageMetadata {
  width: number;
  height: number;
  aspectRatio: number;
  format: SupportedImageFormat;
  fileName: string;
  fileSize: number;
}

export interface ResizeImageOptions {
  width: number;
  height: number;
  format?: SupportedImageFormat;
  quality?: number; // 1 - 100 for lossy formats
  backgroundColor?: string; // Fallback background for transparent source when saving as JPEG
}

export interface ResizeImageResult {
  blob: Blob;
  width: number;
  height: number;
  format: SupportedImageFormat;
  extension: string;
  sizeBytes: number;
  originalSizeBytes: number;
  originalWidth: number;
  originalHeight: number;
  executionTimeMs: number;
}

/**
 * Detects the image format from MIME type or file extension.
 */
export function detectImageFormat(file: File): SupportedImageFormat {
  if (file.type === "image/jpeg" || file.type === "image/jpg") return "image/jpeg";
  if (file.type === "image/png") return "image/png";
  if (file.type === "image/webp") return "image/webp";

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";

  return "image/png";
}

/**
 * Decodes an image file and extracts its natural dimensions and metadata.
 */
export async function getImageMetadata(file: File): Promise<ImageMetadata> {
  if (typeof window === "undefined") {
    throw new ToolProcessingError(
      "UNSUPPORTED_OPERATION",
      "Image processing is only available in the browser."
    );
  }

  if (file.size <= 0) {
    throw new ToolProcessingError("EMPTY_INPUT", "The selected file is empty (0 bytes).");
  }

  const format = detectImageFormat(file);

  // Try createImageBitmap first (fastest and non-blocking)
  if (typeof window.createImageBitmap === "function") {
    try {
      const bitmap = await window.createImageBitmap(file);
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();

      if (width <= 0 || height <= 0) {
        throw new Error("Invalid image dimensions decoded.");
      }

      return {
        width,
        height,
        aspectRatio: width / height,
        format,
        fileName: file.name,
        fileSize: file.size,
      };
    } catch {
      // Fallback to HTMLImageElement below if createImageBitmap fails for this image
    }
  }

  // Fallback: HTMLImageElement decode
  return new Promise<ImageMetadata>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);

      if (width <= 0 || height <= 0) {
        reject(
          new ToolProcessingError(
            "CORRUPTED_FILE",
            "The image dimensions could not be read or the file is corrupted."
          )
        );
        return;
      }

      resolve({
        width,
        height,
        aspectRatio: width / height,
        format,
        fileName: file.name,
        fileSize: file.size,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new ToolProcessingError(
          "CORRUPTED_FILE",
          "Failed to decode image. The file may be damaged or not a valid image format."
        )
      );
    };

    img.src = url;
  });
}

/**
 * Validates dimensions to prevent zero, negative, or memory-crashing sizes.
 */
export function validateDimensions(
  width: number,
  height: number
): { isValid: boolean; error?: string } {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { isValid: false, error: "Width and height must be valid numbers." };
  }

  if (width <= 0 || height <= 0) {
    return { isValid: false, error: "Dimensions must be greater than 0 pixels." };
  }

  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return { isValid: false, error: "Dimensions must be whole pixel numbers." };
  }

  if (width > MAX_SAFE_DIMENSION || height > MAX_SAFE_DIMENSION) {
    return {
      isValid: false,
      error: `Maximum dimension allowed is ${MAX_SAFE_DIMENSION.toLocaleString()}px per side.`,
    };
  }

  if (width * height > MAX_SAFE_AREA) {
    return {
      isValid: false,
      error: `Total image area exceeds safe limit of ${(MAX_SAFE_AREA / 1_000_000).toFixed(0)} megapixels.`,
    };
  }

  return { isValid: true };
}

/**
 * Calculates proportional dimension when aspect ratio is locked.
 */
export function calculateLockedDimension(
  changedDimension: "width" | "height",
  newValue: number,
  aspectRatio: number
): { width: number; height: number } {
  if (aspectRatio <= 0 || !Number.isFinite(aspectRatio)) {
    return { width: newValue, height: newValue };
  }

  if (changedDimension === "width") {
    const width = Math.max(1, Math.round(newValue));
    const height = Math.max(1, Math.round(width / aspectRatio));
    return { width, height };
  } else {
    const height = Math.max(1, Math.round(newValue));
    const width = Math.max(1, Math.round(height * aspectRatio));
    return { width, height };
  }
}

/**
 * Resizes an image file in-browser using Canvas / OffscreenCanvas with high quality bicubic resampling.
 */
export async function resizeImage(
  file: File,
  options: ResizeImageOptions
): Promise<ResizeImageResult> {
  const startTime = performance.now();

  if (typeof window === "undefined") {
    throw new ToolProcessingError(
      "UNSUPPORTED_OPERATION",
      "Image processing must run in the browser."
    );
  }

  const targetWidth = Math.round(options.width);
  const targetHeight = Math.round(options.height);

  const dimCheck = validateDimensions(targetWidth, targetHeight);
  if (!dimCheck.isValid) {
    throw new ToolProcessingError(
      "PROCESSING_FAILED",
      dimCheck.error || "Invalid target dimensions."
    );
  }

  const outputFormat: SupportedImageFormat =
    options.format || detectImageFormat(file);

  const formatConfig = SUPPORTED_IMAGE_FORMATS.find((f) => f.format === outputFormat) || {
    format: "image/png" as SupportedImageFormat,
    label: "PNG",
    extension: "png",
    supportsTransparency: true,
    supportsQuality: false,
  };

  // Decode source image
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
      "Failed to read image for resizing. The file may be corrupt or not a valid image.",
      err
    );
  }

  // Draw and resample using Canvas or OffscreenCanvas
  let blob: Blob;

  try {
    const isOffscreenSupported =
      typeof OffscreenCanvas !== "undefined" &&
      typeof OffscreenCanvas.prototype.convertToBlob === "function";

    // Normalize quality between 0.01 and 1.0 (Canvas API standard)
    const rawQuality = options.quality ?? 85;
    const normalizedQuality = Math.max(0.01, Math.min(1.0, rawQuality / 100));

    if (isOffscreenSupported) {
      const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
      const ctx = offscreen.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to get 2D rendering context for OffscreenCanvas.");
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // If output is JPEG, fill background with solid color (JPEG has no alpha channel)
      if (outputFormat === "image/jpeg") {
        ctx.fillStyle = options.backgroundColor || "#ffffff";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      } else {
        ctx.clearRect(0, 0, targetWidth, targetHeight);
      }

      ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);

      blob = await offscreen.convertToBlob({
        type: outputFormat,
        quality: formatConfig.supportsQuality ? normalizedQuality : undefined,
      });
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to get 2D rendering context for Canvas.");
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // If output is JPEG, fill background with solid color
      if (outputFormat === "image/jpeg") {
        ctx.fillStyle = options.backgroundColor || "#ffffff";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      } else {
        ctx.clearRect(0, 0, targetWidth, targetHeight);
      }

      ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);

      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error("Canvas toBlob produced an empty result."));
            }
          },
          outputFormat,
          formatConfig.supportsQuality ? normalizedQuality : undefined
        );
      });
    }
  } catch (err) {
    throw new ToolProcessingError(
      "PROCESSING_FAILED",
      "An error occurred while resizing the image. Please try different dimensions or format.",
      err
    );
  } finally {
    // Release bitmap resources if applicable
    if ("close" in imageSource && typeof imageSource.close === "function") {
      imageSource.close();
    }
  }

  const executionTimeMs = performance.now() - startTime;

  return {
    blob,
    width: targetWidth,
    height: targetHeight,
    format: outputFormat,
    extension: formatConfig.extension,
    sizeBytes: blob.size,
    originalSizeBytes: file.size,
    originalWidth,
    originalHeight,
    executionTimeMs,
  };
}

/**
 * Generates an output filename following standard naming conventions without overwriting.
 */
export function generateResizedFilename(
  originalFilename: string,
  extension: string
): string {
  const lastDotIndex = originalFilename.lastIndexOf(".");
  const baseName =
    lastDotIndex > 0 ? originalFilename.slice(0, lastDotIndex) : originalFilename;
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return `${safeBaseName || "image"}-resized.${extension}`;
}
