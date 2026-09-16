/**
 * Pure JSON validation engine.
 * Independent from React or UI frameworks.
 * 100% in-browser client-side execution.
 */

import {
  parseJsonError,
  calculateJsonStats,
  formatJson,
  type JsonErrorLocation,
  type JsonStats,
  type JsonIndent,
} from "./json-formatter";

export type JsonRootType =
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "empty";

export interface DetailedValidationResult {
  isValid: boolean;
  type: JsonRootType;
  parsed?: unknown;
  error?: JsonErrorLocation;
  stats: JsonStats;
  depth?: number;
  itemCount?: number;
}

/**
 * Calculates the maximum nesting depth of a JSON object or array.
 */
export function calculateJsonDepth(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;

  if (Array.isArray(value)) {
    if (value.length === 0) return 1;
    let maxChildDepth = 0;
    for (const item of value) {
      maxChildDepth = Math.max(maxChildDepth, calculateJsonDepth(item));
    }
    return 1 + maxChildDepth;
  }

  const keys = Object.keys(value as object);
  if (keys.length === 0) return 1;

  let maxChildDepth = 0;
  for (const key of keys) {
    maxChildDepth = Math.max(
      maxChildDepth,
      calculateJsonDepth((value as Record<string, unknown>)[key])
    );
  }
  return 1 + maxChildDepth;
}

/**
 * Identifies the exact root JSON data type according to RFC 8259.
 */
export function getJsonRootType(parsed: unknown): JsonRootType {
  if (parsed === null) return "null";
  if (Array.isArray(parsed)) return "array";
  const t = typeof parsed;
  if (t === "object") return "object";
  if (t === "string") return "string";
  if (t === "number") return "number";
  if (t === "boolean") return "boolean";
  return "empty";
}

/**
 * Validates a JSON string with comprehensive structure inspection.
 */
export function validateJsonDetail(raw: string): DetailedValidationResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      isValid: false,
      type: "empty",
      error: { message: "Input is empty. Please enter or upload JSON to validate." },
      stats: { lineCount: 0, charCount: 0, byteSize: 0, type: "empty" },
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const type = getJsonRootType(parsed);
    const stats = calculateJsonStats(raw, parsed);
    const depth = calculateJsonDepth(parsed);

    let itemCount: number | undefined;
    if (Array.isArray(parsed)) {
      itemCount = parsed.length;
    } else if (parsed !== null && typeof parsed === "object") {
      itemCount = Object.keys(parsed as object).length;
    }

    return {
      isValid: true,
      type,
      parsed,
      stats,
      depth,
      itemCount,
    };
  } catch (err) {
    const errorLocation =
      err instanceof SyntaxError
        ? parseJsonError(err, raw)
        : { message: err instanceof Error ? err.message : "Invalid JSON syntax." };

    return {
      isValid: false,
      type: "empty",
      error: errorLocation,
      stats: calculateJsonStats(raw),
    };
  }
}

/**
 * Generates a formatted preview for valid JSON, reusing json-formatter logic.
 */
export function getFormattedPreview(
  raw: string,
  indent: JsonIndent = 2,
  sortKeys = false
): string {
  try {
    const { formatted } = formatJson(raw, { indent, sortKeys });
    return formatted;
  } catch {
    return raw;
  }
}

/**
 * Sample JSON payloads for testing and user inspection.
 */
export const SAMPLE_VALID_OBJECT = JSON.stringify(
  {
    status: "success",
    code: 200,
    server: "FileForge Browser Engine",
    clientSide: true,
    data: {
      userId: "usr_94812",
      profile: {
        username: "developer_pro",
        verified: true,
        roles: ["admin", "tester"],
        settings: {
          theme: "light",
          notifications: { email: false, push: true },
        },
      },
    },
    timestamp: 1773595200,
  },
  null,
  2
);

export const SAMPLE_VALID_ARRAY = JSON.stringify(
  [
    { id: 1, tool: "PDF Merger", category: "pdf", free: true },
    { id: 2, tool: "Image Compressor", category: "image", free: true },
    { id: 3, tool: "JSON Validator", category: "developer", free: true },
  ],
  null,
  2
);

export const SAMPLE_INVALID_JSON = `{
  "name": "FileForge",
  "missingComma": "value1"
  "invalidTrailing": "value2",
}`;
