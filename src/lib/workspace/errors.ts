export type ToolErrorCode =
  | "FILE_TOO_LARGE"
  | "FILE_TOO_SMALL"
  | "INVALID_FILE_TYPE"
  | "INVALID_FILE_EXTENSION"
  | "TOO_MANY_FILES"
  | "TOO_FEW_FILES"
  | "EMPTY_INPUT"
  | "CORRUPTED_FILE"
  | "PROCESSING_FAILED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "UNSUPPORTED_OPERATION"
  | "ABORTED";

export class ToolProcessingError extends Error {
  public readonly code: ToolErrorCode;
  public readonly userMessage: string;
  public readonly details?: unknown;

  constructor(code: ToolErrorCode, userMessage: string, details?: unknown) {
    super(userMessage);
    this.name = "ToolProcessingError";
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;

    // Maintains proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ToolProcessingError);
    }
  }
}

/**
 * Normalizes any caught error into a readable user-facing message.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ToolProcessingError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred during processing. Please try again.";
}
