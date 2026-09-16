/**
 * Pure UUID / GUID generation and validation engine.
 * Supports RFC 4122 (v4) and RFC 9562 (v7 time-ordered).
 * Independent of React or UI frameworks.
 * 100% in-browser client-side execution using Web Crypto API.
 */

export type UuidVersion = "v4" | "v7" | "nil";

export interface UuidFormatOptions {
  uppercase?: boolean;
  hyphens?: boolean;
  braces?: boolean;
  quotes?: "none" | "double" | "single";
}

export interface UuidValidationInfo {
  isValid: boolean;
  version?: number;
  variant?: string;
  timestamp?: Date;
  error?: string;
}

/**
 * Generates a cryptographically secure UUID v4.
 */
export function generateUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback using crypto.getRandomValues
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generates a sortable UUID v7 (RFC 9562) with 48-bit Unix timestamp prefix.
 */
export function generateUuidV7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const timestamp = Date.now();
  // 48-bit timestamp in milliseconds
  bytes[0] = (timestamp / 0x10000000000) & 0xff;
  bytes[1] = (timestamp / 0x100000000) & 0xff;
  bytes[2] = (timestamp / 0x1000000) & 0xff;
  bytes[3] = (timestamp / 0x10000) & 0xff;
  bytes[4] = (timestamp / 0x100) & 0xff;
  bytes[5] = timestamp & 0xff;

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // Version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * NIL UUID (RFC 4122)
 */
export const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Formats a raw UUID string according to user choices.
 */
export function formatUuid(raw: string, options: UuidFormatOptions = {}): string {
  let result = raw;

  if (options.hyphens === false) {
    result = result.replace(/-/g, "");
  }

  if (options.uppercase) {
    result = result.toUpperCase();
  } else {
    result = result.toLowerCase();
  }

  if (options.braces) {
    result = `{${result}}`;
  }

  if (options.quotes === "double") {
    result = `"${result}"`;
  } else if (options.quotes === "single") {
    result = `'${result}'`;
  }

  return result;
}

/**
 * Generates a batch of UUIDs.
 */
export function generateUuidBatch(
  quantity: number,
  version: UuidVersion = "v4",
  options: UuidFormatOptions = {}
): string[] {
  const safeCount = Math.max(1, Math.min(quantity, 500));
  const list: string[] = [];

  for (let i = 0; i < safeCount; i++) {
    let raw = "";
    if (version === "v7") {
      raw = generateUuidV7();
    } else if (version === "nil") {
      raw = NIL_UUID;
    } else {
      raw = generateUuidV4();
    }
    list.push(formatUuid(raw, options));
  }

  return list;
}

/**
 * Validates a UUID string and extracts version and timestamp metadata.
 */
export function validateUuid(input: string): UuidValidationInfo {
  const trimmed = input.trim();
  if (!trimmed) {
    return { isValid: false, error: "Input is empty." };
  }

  // Remove potential braces, quotes, or whitespace
  const sanitized = trimmed
    .replace(/^["'{]/, "")
    .replace(/["'}]$/, "")
    .trim();

  if (sanitized === NIL_UUID) {
    return {
      isValid: true,
      version: 0,
      variant: "NIL UUID (all zeros)",
    };
  }

  // Standard UUID format: 8-4-4-4-12
  const standardRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-([89ab][0-9a-f]{3})-[0-9a-f]{12}$/i;
  const match = sanitized.match(standardRegex);

  if (!match) {
    // Check if it's a 32-char hex without hyphens
    if (/^[0-9a-f]{32}$/i.test(sanitized)) {
      const withHyphens = `${sanitized.slice(0, 8)}-${sanitized.slice(8, 12)}-${sanitized.slice(12, 16)}-${sanitized.slice(16, 20)}-${sanitized.slice(20)}`;
      return validateUuid(withHyphens);
    }

    return {
      isValid: false,
      error: "Invalid UUID format. Expected 32 hexadecimal characters in 8-4-4-4-12 hyphenated layout.",
    };
  }

  const verDigit = parseInt(match[1], 16);
  const variant = "RFC 4122 / DCE 1.1";

  let timestamp: Date | undefined;
  if (verDigit === 7) {
    // Extract 48-bit timestamp from first 12 hex chars
    const hexTime = sanitized.replace(/-/g, "").slice(0, 12);
    const millis = parseInt(hexTime, 16);
    if (!isNaN(millis)) {
      timestamp = new Date(millis);
    }
  }

  return {
    isValid: true,
    version: verDigit,
    variant,
    timestamp,
  };
}
