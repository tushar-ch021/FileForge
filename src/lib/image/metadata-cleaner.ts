import { ToolProcessingError } from "@/lib/workspace/errors";
import {
  detectImageFormat,
  getImageMetadata,
  ImageMetadata,
} from "./resize-image";

export interface CameraMetadata {
  make?: string;
  model?: string;
  software?: string;
  lensModel?: string;
}

export interface CaptureMetadata {
  dateTime?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: string;
  focalLength?: string;
  orientation?: string;
  flash?: string;
}

export interface GpsMetadata {
  latitude?: number;
  longitude?: number;
  altitude?: string;
  formattedCoordinates?: string;
  mapsUrl?: string;
}

export interface MetadataTagItem {
  name: string;
  value: string;
  category?: "camera" | "capture" | "gps" | "other";
}

export interface ParsedImageMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  format: string;
  hasExif: boolean;
  hasGps: boolean;
  totalTagCount: number;
  camera: CameraMetadata;
  capture: CaptureMetadata;
  gps: GpsMetadata;
  tagsList: MetadataTagItem[];
}

export interface CleanMetadataOptions {
  quality?: number; // 0.1 to 1.0 (default 0.8 for lossy formats)
  backgroundColor?: string; // Fallback background for JPEG transparency
  targetFormat?: "original" | "image/jpeg" | "image/png" | "image/webp";
}

export interface CleanMetadataResult {
  blob: Blob;
  width: number;
  height: number;
  size: number;
  format: string;
  originalMetadata: ParsedImageMetadata;
  verifiedRemainingTagCount: number;
  verifiedClean: boolean;
  processingTimeMs: number;
}

/**
 * Extracts embedded EXIF, IPTC, XMP, and GPS metadata from an image file using ExifReader.
 * Only reports data that is actually present in the file without fabrication.
 */
export async function extractImageMetadata(file: File): Promise<ParsedImageMetadata> {
  if (!file || file.size === 0) {
    throw new ToolProcessingError("EMPTY_INPUT", "The uploaded file is empty.");
  }

  const format = detectImageFormat(file);
  if (!format) {
    throw new ToolProcessingError(
      "INVALID_FILE_TYPE",
      "Unsupported image format. Please select a JPG, PNG, or WebP image."
    );
  }

  let baseMeta: ImageMetadata;
  try {
    baseMeta = await getImageMetadata(file);
  } catch (err) {
    throw new ToolProcessingError(
      "CORRUPTED_FILE",
      "Unable to decode image metadata. The file may be invalid or damaged.",
      err
    );
  }

  // Dynamically load ExifReader to keep initial bundle light
  let tags: Record<string, { description?: string; value?: unknown }>;
  try {
    const ExifReader = (await import("exifreader")).default || (await import("exifreader"));
    tags = await ExifReader.load(file, { expanded: false });
  } catch {
    // If parsing fails (e.g. image contains no metadata or parser exception), treat as empty
    tags = {};
  }

  const camera: CameraMetadata = {};
  const capture: CaptureMetadata = {};
  const gps: GpsMetadata = {};
  const tagsList: MetadataTagItem[] = [];

  // 1. Camera / Device
  if (tags["Make"]?.description) camera.make = String(tags["Make"].description).trim();
  if (tags["Model"]?.description) camera.model = String(tags["Model"].description).trim();
  if (tags["Software"]?.description) camera.software = String(tags["Software"].description).trim();
  if (tags["LensModel"]?.description) camera.lensModel = String(tags["LensModel"].description).trim();

  // 2. Capture settings
  if (tags["DateTimeOriginal"]?.description) {
    capture.dateTime = String(tags["DateTimeOriginal"].description);
  } else if (tags["DateTime"]?.description) {
    capture.dateTime = String(tags["DateTime"].description);
  }

  if (tags["ExposureTime"]?.description) capture.exposureTime = String(tags["ExposureTime"].description);
  if (tags["FNumber"]?.description) capture.fNumber = String(tags["FNumber"].description);
  if (tags["ISOSpeedRatings"]?.description) capture.iso = String(tags["ISOSpeedRatings"].description);
  if (tags["FocalLength"]?.description) capture.focalLength = String(tags["FocalLength"].description);
  if (tags["Orientation"]?.description) capture.orientation = String(tags["Orientation"].description);
  if (tags["Flash"]?.description) capture.flash = String(tags["Flash"].description);

  // 3. GPS Coordinates
  const latDesc = tags["GPSLatitude"]?.description;
  const lonDesc = tags["GPSLongitude"]?.description;
  const latRef = tags["GPSLatitudeRef"]?.value as string[] | string | undefined;
  const lonRef = tags["GPSLongitudeRef"]?.value as string[] | string | undefined;
  const altDesc = tags["GPSAltitude"]?.description;

  if (latDesc !== undefined && lonDesc !== undefined) {
    const latNum = parseFloat(String(latDesc));
    const lonNum = parseFloat(String(lonDesc));

    if (!isNaN(latNum) && !isNaN(lonNum)) {
      const finalLat = (latRef === "S" || (Array.isArray(latRef) && latRef[0] === "S")) ? -Math.abs(latNum) : latNum;
      const finalLon = (lonRef === "W" || (Array.isArray(lonRef) && lonRef[0] === "W")) ? -Math.abs(lonNum) : lonNum;

      gps.latitude = finalLat;
      gps.longitude = finalLon;
      gps.formattedCoordinates = `${Math.abs(finalLat).toFixed(6)}° ${finalLat >= 0 ? "N" : "S"}, ${Math.abs(finalLon).toFixed(6)}° ${finalLon >= 0 ? "E" : "W"}`;
      gps.mapsUrl = `https://www.google.com/maps?q=${finalLat},${finalLon}`;
    }
  }

  if (altDesc) {
    gps.altitude = String(altDesc);
  }

  // 4. Populate tags list for inspector
  for (const [key, tagObj] of Object.entries(tags)) {
    if (!tagObj || !tagObj.description) continue;
    const val = String(tagObj.description).trim();
    if (!val || val === "undefined" || val === "[object Object]") continue;

    let category: MetadataTagItem["category"] = "other";
    const k = key.toLowerCase();
    if (k.includes("make") || k.includes("model") || k.includes("software") || k.includes("lens")) {
      category = "camera";
    } else if (k.includes("date") || k.includes("iso") || k.includes("exposure") || k.includes("fnumber") || k.includes("flash") || k.includes("shutter")) {
      category = "capture";
    } else if (k.includes("gps") || k.includes("latitude") || k.includes("longitude") || k.includes("altitude")) {
      category = "gps";
    }

    tagsList.push({ name: key, value: val, category });
  }

  const hasGps = gps.latitude !== undefined && gps.longitude !== undefined;
  const hasExif = tagsList.length > 0;

  return {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || baseMeta.format,
    width: baseMeta.width,
    height: baseMeta.height,
    format,
    hasExif,
    hasGps,
    totalTagCount: tagsList.length,
    camera,
    capture,
    gps,
    tagsList,
  };
}

/**
 * Creates a sanitized copy of the image by decoding and re-encoding it via Canvas,
 * discarding embedded metadata chunks. Verifies the result by inspecting the newly encoded blob.
 */
export async function cleanImageMetadata(
  file: File,
  options: CleanMetadataOptions = {}
): Promise<CleanMetadataResult> {
  const startTime = performance.now();
  const { quality = 0.8, backgroundColor = "#ffffff", targetFormat = "original" } = options;

  if (typeof window === "undefined") {
    throw new ToolProcessingError("UNSUPPORTED_OPERATION", "Browser environment required for image cleaning.");
  }

  // 1. Extract original metadata
  const originalMetadata = await extractImageMetadata(file);

  // 2. Determine target output MIME type
  let outputMime = file.type || "image/jpeg";
  if (targetFormat !== "original") {
    outputMime = targetFormat;
  }
  if (!outputMime || outputMime === "application/octet-stream") {
    outputMime = "image/jpeg";
  }

  // 3. Decode and re-render onto clean canvas
  const cleanedBlob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new ToolProcessingError("PROCESSING_FAILED", "Failed to initialize canvas context."));
          return;
        }

        // If target is JPEG and source could have transparency, fill with background color
        if (outputMime === "image/jpeg") {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Native re-encoding discards original metadata chunks
        const encQuality = outputMime === "image/png" ? undefined : quality;
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new ToolProcessingError("PROCESSING_FAILED", "Failed to re-encode cleaned image."));
              return;
            }
            resolve(blob);
          },
          outputMime,
          encQuality
        );
      } catch (err) {
        reject(new ToolProcessingError("PROCESSING_FAILED", "Canvas re-encoding error.", err));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ToolProcessingError("CORRUPTED_FILE", "Failed to decode image data for sanitization."));
    };

    img.src = url;
  });

  // 4. Verify resulting file by inspecting for remaining metadata
  let remainingTagCount = 0;
  try {
    const ExifReader = (await import("exifreader")).default || (await import("exifreader"));
    const buffer = await cleanedBlob.arrayBuffer();
    const verifiedTags = await ExifReader.load(buffer, { expanded: false });
    // Filter out minimal synthetic container properties if any
    const realTags = Object.entries(verifiedTags).filter(
      ([k]) => !k.toLowerCase().includes("imagesize") && !k.toLowerCase().includes("filetype")
    );
    remainingTagCount = realTags.length;
  } catch {
    remainingTagCount = 0;
  }

  const endTime = performance.now();

  return {
    blob: cleanedBlob,
    width: originalMetadata.width,
    height: originalMetadata.height,
    size: cleanedBlob.size,
    format: outputMime,
    originalMetadata,
    verifiedRemainingTagCount: remainingTagCount,
    verifiedClean: remainingTagCount === 0,
    processingTimeMs: Math.round(endTime - startTime),
  };
}

/**
 * Generates a non-overwriting filename for the cleaned image.
 */
export function generateCleanedFilename(originalName: string, targetMime?: string): string {
  const lastDot = originalName.lastIndexOf(".");
  const baseName = lastDot !== -1 ? originalName.substring(0, lastDot) : originalName;

  let ext = "jpg";
  if (targetMime) {
    if (targetMime === "image/png") ext = "png";
    else if (targetMime === "image/webp") ext = "webp";
    else if (targetMime === "image/jpeg") ext = "jpg";
  } else if (lastDot !== -1) {
    ext = originalName.substring(lastDot + 1).toLowerCase();
  }

  return `${baseName}-cleaned.${ext}`;
}
