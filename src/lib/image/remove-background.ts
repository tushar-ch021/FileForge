import { ToolProcessingError } from "@/lib/workspace/errors";
import {
  detectImageFormat,
  getImageMetadata,
  ImageMetadata,
} from "./resize-image";

export type BackgroundRemovalModel = "small" | "medium";
export type BackgroundRemovalDevice = "auto" | "gpu" | "cpu";

export type BackgroundRemovalStage =
  | "initializing"
  | "downloading-model"
  | "processing-image"
  | "generating-output"
  | "complete";

export interface BackgroundRemovalProgress {
  stage: BackgroundRemovalStage;
  message: string;
  percentage?: number; // 0 to 100, undefined if indeterminate
  details?: string;
}

export interface RemoveBackgroundOptions {
  model?: BackgroundRemovalModel; // "small" (~40MB, faster/mobile) or "medium" (~80MB, higher precision)
  device?: BackgroundRemovalDevice; // "auto", "gpu" (WebGPU), or "cpu" (WASM)
  onProgress?: (progress: BackgroundRemovalProgress) => void;
}

export interface RemoveBackgroundResult {
  blob: Blob;
  width: number;
  height: number;
  size: number;
  format: "image/png";
  executionDevice: "webgpu" | "cpu";
  modelUsed: BackgroundRemovalModel;
  processingTimeMs: number;
  hasTransparency: boolean;
}

/**
 * Checks if the current browser and hardware support WebGPU.
 */
export async function checkWebGpuSupport(): Promise<boolean> {
  if (typeof window === "undefined" || !("gpu" in navigator)) {
    return false;
  }
  try {
    const nav = navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } };
    if (!nav.gpu || typeof nav.gpu.requestAdapter !== "function") {
      return false;
    }
    const adapter = await nav.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

/**
 * Verifies that an image blob actually contains transparent pixels (alpha < 255).
 */
export async function verifyPngTransparency(
  blob: Blob
): Promise<{ hasTransparency: boolean; transparentPixelCount: number }> {
  if (typeof window === "undefined") {
    return { hasTransparency: false, transparentPixelCount: 0 };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement("canvas");
        const w = Math.min(img.naturalWidth || img.width, 400); // Sample down for speed if large
        const h = Math.min(img.naturalHeight || img.height, 400);
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve({ hasTransparency: true, transparentPixelCount: 0 });
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        let transparentPixels = 0;

        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 250) {
            transparentPixels++;
          }
        }

        resolve({
          hasTransparency: transparentPixels > 0,
          transparentPixelCount: transparentPixels,
        });
      } catch {
        resolve({ hasTransparency: true, transparentPixelCount: 0 });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ hasTransparency: false, transparentPixelCount: 0 });
    };

    img.src = url;
  });
}

/**
 * Removes the background of an image using client-side AI (@imgly/background-removal).
 * Executes 100% locally in the browser with WebGPU acceleration and WASM CPU fallback.
 */
export async function removeImageBackground(
  file: File,
  options: RemoveBackgroundOptions = {}
): Promise<RemoveBackgroundResult> {
  const startTime = performance.now();
  const { model = "medium", device = "auto", onProgress } = options;

  // 1. Basic validation
  if (!file || file.size === 0) {
    throw new ToolProcessingError(
      "EMPTY_INPUT",
      "The uploaded file is empty. Please select a valid image."
    );
  }

  const format = detectImageFormat(file);
  if (!format) {
    throw new ToolProcessingError(
      "INVALID_FILE_TYPE",
      "Unsupported image format. Please upload a JPG, PNG, or WebP image."
    );
  }

  // 2. Extract dimensions
  let metadata: ImageMetadata;
  try {
    metadata = await getImageMetadata(file);
  } catch (err) {
    throw new ToolProcessingError(
      "CORRUPTED_FILE",
      "Unable to read image metadata. The file may be corrupted or unreadable.",
      err
    );
  }

  // 3. Determine execution device (WebGPU vs CPU)
  let targetDevice: "gpu" | "cpu" = "cpu";
  if (device === "gpu") {
    targetDevice = "gpu";
  } else if (device === "auto") {
    const isWebGpuSupported = await checkWebGpuSupport();
    targetDevice = isWebGpuSupported ? "gpu" : "cpu";
  }

  onProgress?.({
    stage: "initializing",
    message: "Initializing background removal AI engine...",
  });

  // 4. Dynamically import @imgly/background-removal (0 initial bundle impact)
  let removeBackground: (
    image: Blob | File | string,
    config?: Record<string, unknown>
  ) => Promise<Blob>;

  try {
    const imglyModule = await import("@imgly/background-removal");
    removeBackground = (imglyModule.default || imglyModule.removeBackground) as unknown as (
      image: Blob | File | string,
      config?: Record<string, unknown>
    ) => Promise<Blob>;
  } catch (err) {
    throw new ToolProcessingError(
      "PROCESSING_FAILED",
      "Failed to load the background removal AI library. Please verify your connection or try refreshing.",
      err
    );
  }

  // 5. Build configuration with progress tracking
  const runInference = async (execDevice: "gpu" | "cpu"): Promise<Blob> => {
    const config: Record<string, unknown> = {
      model,
      device: execDevice,
      output: {
        format: "image/png",
        quality: 1.0,
      },
      progress: (key: string, current: number, total: number) => {
        const keyLower = (key || "").toLowerCase();

        if (keyLower.includes("fetch") || keyLower.includes("model")) {
          const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : undefined;
          onProgress?.({
            stage: "downloading-model",
            message:
              pct !== undefined
                ? `Downloading AI model weights (${pct}%)...`
                : "Loading AI model weights from browser cache...",
            percentage: pct,
            details:
              total > 0
                ? `${(current / (1024 * 1024)).toFixed(1)} MB / ${(total / (1024 * 1024)).toFixed(1)} MB`
                : undefined,
          });
        } else if (keyLower.includes("compute") || keyLower.includes("inference")) {
          onProgress?.({
            stage: "processing-image",
            message: "Detecting subject and isolating background...",
          });
        } else if (keyLower.includes("encode") || keyLower.includes("output")) {
          onProgress?.({
            stage: "generating-output",
            message: "Compositing transparent alpha cutout...",
          });
        }
      },
    };

    return await removeBackground(file, config);
  };

  let outputBlob: Blob;
  let actualDeviceUsed: "webgpu" | "cpu" = targetDevice === "gpu" ? "webgpu" : "cpu";

  try {
    outputBlob = await runInference(targetDevice);
  } catch (initialErr) {
    // If WebGPU failed, attempt graceful fallback to CPU/WASM
    if (targetDevice === "gpu") {
      try {
        onProgress?.({
          stage: "initializing",
          message: "WebGPU acceleration unavailable, falling back to WebAssembly CPU engine...",
        });
        actualDeviceUsed = "cpu";
        outputBlob = await runInference("cpu");
      } catch (fallbackErr) {
        throw new ToolProcessingError(
          "MEMORY_LIMIT_EXCEEDED",
          "AI background removal failed during CPU processing. Your device may be low on memory.",
          fallbackErr
        );
      }
    } else {
      throw new ToolProcessingError(
        "PROCESSING_FAILED",
        "AI background removal failed during processing. Please ensure the image is valid.",
        initialErr
      );
    }
  }

  // 6. Verify result transparency
  onProgress?.({
    stage: "generating-output",
    message: "Verifying transparency channels...",
  });

  const transparencyCheck = await verifyPngTransparency(outputBlob);

  onProgress?.({
    stage: "complete",
    message: "Background successfully removed!",
    percentage: 100,
  });

  const endTime = performance.now();

  return {
    blob: outputBlob,
    width: metadata.width,
    height: metadata.height,
    size: outputBlob.size,
    format: "image/png",
    executionDevice: actualDeviceUsed,
    modelUsed: model,
    processingTimeMs: Math.round(endTime - startTime),
    hasTransparency: transparencyCheck.hasTransparency,
  };
}

/**
 * Composites a transparent cutout PNG onto a solid background color (e.g. #FFFFFF).
 */
export async function applyBackgroundColor(
  transparentBlob: Blob,
  backgroundColor: string
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new ToolProcessingError(
      "UNSUPPORTED_OPERATION",
      "Browser environment required for image compositing."
    );
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(transparentBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement("canvas");
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(
            new ToolProcessingError("PROCESSING_FAILED", "Failed to initialize canvas context.")
          );
          return;
        }

        // Paint solid background color
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Draw transparent cutout on top
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new ToolProcessingError(
                  "PROCESSING_FAILED",
                  "Failed to generate composited image."
                )
              );
              return;
            }
            resolve(blob);
          },
          "image/png",
          1.0
        );
      } catch (err) {
        reject(
          new ToolProcessingError("PROCESSING_FAILED", "Error compositing background color.", err)
        );
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new ToolProcessingError(
          "CORRUPTED_FILE",
          "Failed to load transparent image for compositing."
        )
      );
    };

    img.src = url;
  });
}

/**
 * Generates a non-overwriting filename for the background-removed PNG.
 */
export function generateBackgroundRemovedFilename(
  originalName: string,
  hasSolidBackground: boolean = false
): string {
  const lastDot = originalName.lastIndexOf(".");
  const baseName = lastDot !== -1 ? originalName.substring(0, lastDot) : originalName;
  const suffix = hasSolidBackground ? "-custom-background" : "-background-removed";
  return `${baseName}${suffix}.png`;
}
