/**
 * Pure JSON processing engine.
 * Independent of React or UI frameworks.
 * 100% in-browser client-side execution.
 */

export type JsonIndent = 2 | 4 | "tab";

export interface JsonErrorLocation {
  message: string;
  line?: number;
  column?: number;
  position?: number;
}

export interface JsonValidationResult {
  isValid: boolean;
  error?: JsonErrorLocation;
  parsed?: unknown;
}

export interface JsonStats {
  lineCount: number;
  charCount: number;
  byteSize: number;
  type: "object" | "array" | "primitive" | "null" | "empty";
  keyCount?: number;
}

export interface JsonFormatOptions {
  indent?: JsonIndent;
  sortKeys?: boolean;
}

/**
 * Extracts line and column from a character position in text.
 */
function getLineAndColumn(text: string, position: number): { line: number; column: number } {
  const safePos = Math.max(0, Math.min(position, text.length));
  const lines = text.slice(0, safePos).split("\n");
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

/**
 * Extracts line and column from JSON SyntaxError messages across modern engines.
 */
export function parseJsonError(error: SyntaxError, rawText: string): JsonErrorLocation {
  const msg = error.message;

  // 1. Check for standard "position X" (V8 / Node / Chrome)
  const posMatch = msg.match(/position\s+(\d+)/i);
  if (posMatch) {
    const position = parseInt(posMatch[1], 10);
    const { line, column } = getLineAndColumn(rawText, position);
    return {
      message: msg.replace(/at position \d+/i, "").trim(),
      line,
      column,
      position,
    };
  }

  // 2. Check for explicit "line X column Y" (Firefox / Safari / SpiderMonkey)
  const lineColMatch = msg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch) {
    return {
      message: msg,
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
    };
  }

  // 3. Check for snippet in modern V8: Unexpected token '...', ..."..." is not valid JSON
  const snippetMatch = msg.match(/\.\.\."([^"]+)"/);
  if (snippetMatch) {
    const snippet = snippetMatch[1];
    const index = rawText.indexOf(snippet);
    if (index !== -1) {
      const { line, column } = getLineAndColumn(rawText, index + snippet.length - 1);
      return {
        message: msg,
        line,
        column,
        position: index + snippet.length - 1,
      };
    }
  }

  return { message: msg };
}

/**
 * Recursively sorts object keys alphabetically.
 */
function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  if (obj !== null && typeof obj === "object") {
    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sortedObj[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sortedObj;
  }
  return obj;
}

/**
 * Calculates byte size accurately for Unicode strings.
 */
export function getUtf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Calculates statistics for JSON text and parsed structure.
 */
export function calculateJsonStats(text: string, parsedData?: unknown): JsonStats {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      lineCount: 0,
      charCount: 0,
      byteSize: 0,
      type: "empty",
    };
  }

  const lineCount = text ? text.split("\n").length : 0;
  const charCount = text.length;
  const byteSize = getUtf8ByteLength(text);

  let type: JsonStats["type"] = "primitive";
  let keyCount: number | undefined;

  if (parsedData === null) {
    type = "null";
  } else if (Array.isArray(parsedData)) {
    type = "array";
    keyCount = parsedData.length;
  } else if (typeof parsedData === "object") {
    type = "object";
    keyCount = Object.keys(parsedData as object).length;
  }

  return {
    lineCount,
    charCount,
    byteSize,
    type,
    keyCount,
  };
}

/**
 * Validates a JSON string and returns parsed data or diagnostic error coordinates.
 */
export function validateJson(raw: string): JsonValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: { message: "Input is empty. Please provide JSON text." },
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      isValid: true,
      parsed,
    };
  } catch (err) {
    const errorLocation =
      err instanceof SyntaxError
        ? parseJsonError(err, raw)
        : { message: err instanceof Error ? err.message : "Invalid JSON syntax." };

    return {
      isValid: false,
      error: errorLocation,
    };
  }
}

/**
 * Formats/beautifies a JSON string with indentation and optional key sorting.
 */
export function formatJson(
  raw: string,
  options: JsonFormatOptions = {}
): { formatted: string; stats: JsonStats } {
  const validation = validateJson(raw);
  if (!validation.isValid || validation.parsed === undefined) {
    throw new Error(validation.error?.message || "Invalid JSON syntax.");
  }

  let data: unknown = validation.parsed;
  if (options.sortKeys) {
    data = sortObjectKeys(data);
  }

  const indentStr =
    options.indent === "tab" ? "\t" : options.indent === 4 ? 4 : 2;

  const formatted = JSON.stringify(data, null, indentStr);
  const stats = calculateJsonStats(formatted, data);

  return { formatted, stats };
}

/**
 * Minifies a JSON string by removing all whitespace and newlines.
 */
export function minifyJson(raw: string): { minified: string; stats: JsonStats } {
  const validation = validateJson(raw);
  if (!validation.isValid || validation.parsed === undefined) {
    throw new Error(validation.error?.message || "Invalid JSON syntax.");
  }

  const minified = JSON.stringify(validation.parsed);
  const stats = calculateJsonStats(minified, validation.parsed);

  return { minified, stats };
}

/**
 * Realistic sample JSON payload for quick testing and demonstration.
 */
export const SAMPLE_JSON = JSON.stringify(
  {
    name: "FileForge Platform",
    version: "1.0.0",
    private: true,
    features: [
      "Client-side processing",
      "Zero server uploads",
      "WASM acceleration",
      "Universal file format support",
    ],
    suites: {
      pdf: { toolsCount: 9, isClientSide: true },
      image: { toolsCount: 7, formats: ["PNG", "JPG", "WebP", "AVIF", "SVG"] },
      developer: {
        toolsCount: 10,
        unicodeSupported: "🚀 100% UTF-8 Compliant — 日本語 & Español",
      },
    },
    performanceScore: 99.8,
    metadata: {
      tags: ["privacy", "offline-ready", "free"],
      lastAuditTimestamp: 1773595200,
    },
  },
  null,
  2
);
