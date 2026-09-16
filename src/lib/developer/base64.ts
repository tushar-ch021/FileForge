/**
 * Pure Base64 encoding and decoding engine with full UTF-8 Unicode support.
 * Independent of React or UI frameworks.
 * 100% in-browser client-side execution.
 */

export interface Base64Options {
  urlSafe?: boolean;
  stripPadding?: boolean;
  lineWrap?: number; // e.g. 76 for MIME, 0 for none
}

export interface Base64Stats {
  inputChars: number;
  inputBytes: number;
  outputChars: number;
  outputBytes: number;
  sizeRatio: string;
}

export interface Base64ConversionResult {
  success: boolean;
  result: string;
  stats: Base64Stats;
  error?: string;
}

/**
 * Calculates byte length of a string in UTF-8.
 */
export function getUtf8Bytes(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Encodes a UTF-8 string into Base64.
 */
export function encodeBase64(text: string, options: Base64Options = {}): Base64ConversionResult {
  if (!text) {
    return {
      success: true,
      result: "",
      stats: { inputChars: 0, inputBytes: 0, outputChars: 0, outputBytes: 0, sizeRatio: "0%" },
    };
  }

  try {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    const len = bytes.byteLength;
    // Chunking to avoid stack overflow with large inputs
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }

    let b64 = btoa(binary);

    if (options.urlSafe) {
      b64 = b64.replace(/\+/g, "-").replace(/\//g, "_");
      if (options.stripPadding) {
        b64 = b64.replace(/=+$/, "");
      }
    } else if (options.stripPadding) {
      b64 = b64.replace(/=+$/, "");
    }

    if (options.lineWrap && options.lineWrap > 0) {
      const regex = new RegExp(`.{1,${options.lineWrap}}`, "g");
      b64 = b64.match(regex)?.join("\n") || b64;
    }

    const inputBytes = bytes.length;
    const outputBytes = getUtf8Bytes(b64);
    const ratio = inputBytes > 0 ? `${((outputBytes / inputBytes) * 100).toFixed(0)}%` : "100%";

    return {
      success: true,
      result: b64,
      stats: {
        inputChars: text.length,
        inputBytes,
        outputChars: b64.length,
        outputBytes,
        sizeRatio: ratio,
      },
    };
  } catch (err) {
    return {
      success: false,
      result: "",
      error: err instanceof Error ? err.message : "Failed to encode text to Base64.",
      stats: { inputChars: text.length, inputBytes: getUtf8Bytes(text), outputChars: 0, outputBytes: 0, sizeRatio: "0%" },
    };
  }
}

/**
 * Decodes a Base64 string back into UTF-8 text.
 */
export function decodeBase64(b64Input: string): Base64ConversionResult {
  const trimmed = b64Input.trim();
  if (!trimmed) {
    return {
      success: true,
      result: "",
      stats: { inputChars: 0, inputBytes: 0, outputChars: 0, outputBytes: 0, sizeRatio: "0%" },
    };
  }

  try {
    // Remove whitespace and newlines
    let sanitized = trimmed.replace(/\s+/g, "");

    // Convert URL-safe base64 characters back to standard base64
    sanitized = sanitized.replace(/-/g, "+").replace(/_/g, "/");

    // Add back missing padding '='
    while (sanitized.length % 4 !== 0) {
      sanitized += "=";
    }

    // Validate Base64 characters
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(sanitized)) {
      return {
        success: false,
        result: "",
        error: "Invalid Base64 sequence. Input contains characters outside the Base64 alphabet.",
        stats: { inputChars: trimmed.length, inputBytes: getUtf8Bytes(trimmed), outputChars: 0, outputBytes: 0, sizeRatio: "0%" },
      };
    }

    const binary = atob(sanitized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const inputBytes = getUtf8Bytes(trimmed);
    const outputBytes = bytes.length;
    const ratio = inputBytes > 0 ? `${((outputBytes / inputBytes) * 100).toFixed(0)}%` : "100%";

    return {
      success: true,
      result: decoded,
      stats: {
        inputChars: trimmed.length,
        inputBytes,
        outputChars: decoded.length,
        outputBytes,
        sizeRatio: ratio,
      },
    };
  } catch (err) {
    return {
      success: false,
      result: "",
      error: err instanceof Error ? err.message : "Malformed Base64 input string.",
      stats: { inputChars: trimmed.length, inputBytes: getUtf8Bytes(trimmed), outputChars: 0, outputBytes: 0, sizeRatio: "0%" },
    };
  }
}

/**
 * Checks if a string is a plausible Base64 string.
 */
export function isValidBase64(str: string): boolean {
  const trimmed = str.trim().replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!trimmed || trimmed.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed);
}

export const SAMPLE_TEXT_FOR_ENCODING = `Hello FileForge! 🚀
Fast, privacy-first developer tools running 100% in your browser.
Unicode test: 日本語, Español, Français, Deutsch, Русский, العربية, 🌟🎉🔒`;

export const SAMPLE_BASE64_FOR_DECODING = `SGVsbG8gRmlsZUZvcmdlISDwn5mpCkZhc3QsIHByaXZhY3ktZmlyc3QgZGV2ZWxvcGVyIHRvb2xzIHJ1bm5pbmcgMTAwJSBpbiB5b3VyIGJyb3dzZXIuClVuaWNvZGUgdGVzdDog5pel5pys6KqeLCBFc3Bhw7FvbCwgRnJhbsOnYWlzLCBEZXV0c2NoLCDQoNGD0YHRgdC60LjQuSwg2KfZhNi52LHYqNmK2KksIPCfjJ/wn46J8J+UkQ==`;
