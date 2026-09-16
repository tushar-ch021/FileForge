/**
 * Pure URL encoding, decoding, and query string inspection engine.
 * Independent of React or UI frameworks.
 * 100% in-browser client-side execution.
 */

export type UrlEncodeMode = "component" | "full";

export interface UrlEncodeOptions {
  mode?: UrlEncodeMode;
  rfc3986?: boolean; // strictly encode !'()*
  spaceAsPlus?: boolean; // replace spaces with + instead of %20
}

export interface QueryParamItem {
  key: string;
  rawValue: string;
  decodedValue: string;
}

export interface UrlConversionResult {
  success: boolean;
  result: string;
  charCount: number;
  encodedCount: number;
  queryParams?: QueryParamItem[];
  error?: string;
}

/**
 * Strict RFC 3986 encoding for !'()*
 */
function rfc3986Encode(str: string): string {
  return str.replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Extracts and parses query parameters from a URL or raw query string.
 */
export function parseQueryParams(input: string): QueryParamItem[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  let queryStr = trimmed;
  const questionIndex = trimmed.indexOf("?");
  if (questionIndex !== -1) {
    queryStr = trimmed.slice(questionIndex + 1);
  }

  // Remove hash fragment if present
  const hashIndex = queryStr.indexOf("#");
  if (hashIndex !== -1) {
    queryStr = queryStr.slice(0, hashIndex);
  }

  if (!queryStr.includes("=") && !queryStr.includes("&")) {
    return [];
  }

  const pairs = queryStr.split("&");
  const params: QueryParamItem[] = [];

  for (const pair of pairs) {
    if (!pair) continue;
    const eqIndex = pair.indexOf("=");
    let rawKey = "";
    let rawValue = "";

    if (eqIndex === -1) {
      rawKey = pair;
      rawValue = "";
    } else {
      rawKey = pair.slice(0, eqIndex);
      rawValue = pair.slice(eqIndex + 1);
    }

    try {
      params.push({
        key: decodeURIComponent(rawKey.replace(/\+/g, " ")),
        rawValue,
        decodedValue: decodeURIComponent(rawValue.replace(/\+/g, " ")),
      });
    } catch {
      params.push({
        key: rawKey,
        rawValue,
        decodedValue: rawValue,
      });
    }
  }

  return params;
}

/**
 * Encodes a URL or query string with customizable options.
 */
export function encodeUrl(input: string, options: UrlEncodeOptions = {}): UrlConversionResult {
  if (!input) {
    return { success: true, result: "", charCount: 0, encodedCount: 0 };
  }

  try {
    let encoded = options.mode === "full" ? encodeURI(input) : encodeURIComponent(input);

    if (options.rfc3986) {
      encoded = rfc3986Encode(encoded);
    }

    if (options.spaceAsPlus) {
      encoded = encoded.replace(/%20/g, "+");
    }

    // Count how many %xx escape sequences were introduced
    const percentMatches = encoded.match(/%[0-9A-Fa-f]{2}/g);
    const encodedCount = percentMatches ? percentMatches.length : 0;
    const queryParams = parseQueryParams(input);

    return {
      success: true,
      result: encoded,
      charCount: encoded.length,
      encodedCount,
      queryParams: queryParams.length > 0 ? queryParams : undefined,
    };
  } catch (err) {
    return {
      success: false,
      result: "",
      charCount: 0,
      encodedCount: 0,
      error: err instanceof Error ? err.message : "Failed to encode URL.",
    };
  }
}

/**
 * Decodes a percent-encoded URL or query string.
 */
export function decodeUrl(input: string, options: { spaceAsPlus?: boolean } = {}): UrlConversionResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { success: true, result: "", charCount: 0, encodedCount: 0 };
  }

  try {
    let sanitized = trimmed;
    if (options.spaceAsPlus) {
      sanitized = sanitized.replace(/\+/g, "%20");
    }

    let decoded = "";
    try {
      decoded = decodeURIComponent(sanitized);
    } catch {
      // Fallback: try decodeURI if component decode failed
      decoded = decodeURI(sanitized);
    }

    const queryParams = parseQueryParams(decoded);

    return {
      success: true,
      result: decoded,
      charCount: decoded.length,
      encodedCount: 0,
      queryParams: queryParams.length > 0 ? queryParams : undefined,
    };
  } catch (err) {
    // Provide pinpoint diagnostics for malformed percent-encoding
    const match = trimmed.match(/%([^0-9A-Fa-f]{2}|[^0-9A-Fa-f].|$)/);
    let detail = "Malformed percent-encoded sequence.";
    if (match) {
      detail = `Invalid percent-encoding '${match[0]}' at position ${match.index}. Expected two hexadecimal characters following '%'.`;
    }

    return {
      success: false,
      result: "",
      charCount: 0,
      encodedCount: 0,
      error: `${err instanceof Error ? err.message : "URI malformed"}. ${detail}`,
    };
  }
}

export const SAMPLE_URL_RAW = `https://fileforge.io/search?category=developer tools&query=JSON & YAML#section-1`;
export const SAMPLE_URL_ENCODED = `https%3A%2F%2Ffileforge.io%2Fsearch%3Fcategory%3Ddeveloper%20tools%26query%3DJSON%20%26%20YAML%23section-1`;
