export type ProcessingStatus =
  | "idle"
  | "reading"
  | "validating"
  | "processing"
  | "success"
  | "error";

export interface FileValidationOptions {
  /** Maximum allowed size in bytes (e.g., 50 * 1024 * 1024 for 50MB) */
  maxSizeBytes?: number;
  /** Minimum allowed size in bytes (e.g., 1 byte) */
  minSizeBytes?: number;
  /** Allowed MIME types (e.g., ['application/pdf', 'image/png']) */
  acceptedMimeTypes?: string[];
  /** Allowed file extensions with leading dot (e.g., ['.pdf', '.png', '.jpg']) */
  acceptedExtensions?: string[];
  /** Maximum number of files allowed for batch operations */
  maxFiles?: number;
  /** Minimum number of files required */
  minFiles?: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  code?: string;
}

export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  originalSizeBytes?: number;
  error?: string;
  executionTimeMs?: number;
  objectUrl?: string;
}

export interface DownloadOptions {
  filename: string;
  mimeType?: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}
