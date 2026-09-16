import { FileValidationOptions, ValidationResult } from "@/types/workspace";

/**
 * Formats bytes into a human-readable string (e.g. 1.25 MB).
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  if (bytes < 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  if (i >= sizes.length) {
    return `${(bytes / Math.pow(k, sizes.length - 1)).toFixed(dm)} ${sizes[sizes.length - 1]}`;
  }

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Calculates byte savings and percentage saved between two file sizes.
 */
export function calculateSavings(
  originalSizeBytes: number,
  newSizeBytes: number
): {
  bytesSaved: number;
  percentageSaved: number;
  isSmaller: boolean;
} {
  if (originalSizeBytes <= 0) {
    return { bytesSaved: 0, percentageSaved: 0, isSmaller: false };
  }

  const bytesSaved = originalSizeBytes - newSizeBytes;
  const percentageSaved = Math.max(
    0,
    Math.round((bytesSaved / originalSizeBytes) * 100)
  );

  return {
    bytesSaved,
    percentageSaved,
    isSmaller: bytesSaved > 0,
  };
}

/**
 * Validates a single file against provided size and type criteria.
 */
export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): ValidationResult {
  // 1. Max Size Check
  if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
    return {
      isValid: false,
      code: "FILE_TOO_LARGE",
      error: `File "${file.name}" exceeds the maximum size limit of ${formatBytes(options.maxSizeBytes)}. (File size: ${formatBytes(file.size)})`,
    };
  }

  // 2. Min Size Check
  if (options.minSizeBytes && file.size < options.minSizeBytes) {
    return {
      isValid: false,
      code: "FILE_TOO_SMALL",
      error: `File "${file.name}" is too small or empty (${formatBytes(file.size)}).`,
    };
  }

  // 3. Extension Check
  if (options.acceptedExtensions && options.acceptedExtensions.length > 0) {
    const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
    const normalizedAccepted = options.acceptedExtensions.map((e) =>
      e.toLowerCase().startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`
    );

    if (!normalizedAccepted.includes(ext)) {
      return {
        isValid: false,
        code: "INVALID_FILE_EXTENSION",
        error: `File format "${ext}" is not supported. Accepted formats: ${normalizedAccepted.join(", ")}`,
      };
    }
  }

  // 4. MIME Type Check
  if (options.acceptedMimeTypes && options.acceptedMimeTypes.length > 0) {
    // If the file MIME type is empty (can happen on some OSs), allow extension check to take precedence
    if (file.type && !options.acceptedMimeTypes.includes(file.type)) {
      // Check wildcard MIME types like image/*
      const isWildcardMatch = options.acceptedMimeTypes.some((type) => {
        if (type.endsWith("/*")) {
          const prefix = type.replace("/*", "");
          return file.type.startsWith(prefix);
        }
        return false;
      });

      if (!isWildcardMatch) {
        return {
          isValid: false,
          code: "INVALID_FILE_TYPE",
          error: `MIME type "${file.type}" is not supported. Accepted types: ${options.acceptedMimeTypes.join(", ")}`,
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Validates a collection of files against count and individual criteria.
 */
export function validateFiles(
  files: File[],
  options: FileValidationOptions = {}
): ValidationResult {
  if (options.minFiles && files.length < options.minFiles) {
    return {
      isValid: false,
      code: "TOO_FEW_FILES",
      error: `Please select at least ${options.minFiles} file${options.minFiles > 1 ? "s" : ""}.`,
    };
  }

  if (options.maxFiles && files.length > options.maxFiles) {
    return {
      isValid: false,
      code: "TOO_MANY_FILES",
      error: `You can only process up to ${options.maxFiles} files at once. You selected ${files.length}.`,
    };
  }

  for (const file of files) {
    const result = validateFile(file, options);
    if (!result.isValid) {
      return result;
    }
  }

  return { isValid: true };
}
