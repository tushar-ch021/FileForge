/**
 * Pure JWT decoding and claims inspection engine.
 * Independent of React or UI frameworks.
 * 100% in-browser client-side execution.
 */

export interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

export interface JwtExpirationInfo {
  isExpired: boolean;
  isNotYetValid: boolean;
  expirationDate?: Date;
  notBeforeDate?: Date;
  issuedAtDate?: Date;
  timeUntilExpiration?: string;
  timeSinceExpiration?: string;
  statusMessage: string;
  statusVariant: "active" | "expired" | "not-yet-valid" | "no-expiry";
}

export interface JwtClaimSummary {
  name: string;
  key: string;
  value: string;
  description: string;
}

export interface JwtDecodeResult {
  isValid: boolean;
  error?: string;
  rawHeader?: string;
  rawPayload?: string;
  rawSignature?: string;
  header?: JwtHeader;
  payload?: JwtPayload;
  formattedHeader?: string;
  formattedPayload?: string;
  expirationInfo?: JwtExpirationInfo;
  standardClaims?: JwtClaimSummary[];
}

/**
 * Decodes a base64url-encoded string to UTF-8 text safely.
 */
export function decodeBase64Url(base64UrlStr: string): string {
  let base64 = base64UrlStr.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Formats a duration in seconds into a friendly human-readable string.
 */
export function formatDuration(seconds: number): string {
  const absSec = Math.abs(seconds);
  const days = Math.floor(absSec / 86400);
  const hours = Math.floor((absSec % 86400) / 3600);
  const minutes = Math.floor((absSec % 3600) / 60);
  const secs = Math.floor(absSec % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.slice(0, 2).join(" ");
}

/**
 * Formats a Unix timestamp (seconds) to a localized date string.
 */
export function formatUnixDate(seconds: number): string {
  const date = new Date(seconds * 1000);
  return `${date.toLocaleString()} (${date.toISOString()})`;
}

/**
 * Evaluates expiration and timing claims from a JWT payload.
 */
export function evaluateJwtExpiration(payload: JwtPayload): JwtExpirationInfo {
  const now = Math.floor(Date.now() / 1000);

  const exp = typeof payload.exp === "number" ? payload.exp : undefined;
  const nbf = typeof payload.nbf === "number" ? payload.nbf : undefined;
  const iat = typeof payload.iat === "number" ? payload.iat : undefined;

  const expirationDate = exp ? new Date(exp * 1000) : undefined;
  const notBeforeDate = nbf ? new Date(nbf * 1000) : undefined;
  const issuedAtDate = iat ? new Date(iat * 1000) : undefined;

  if (nbf && now < nbf) {
    const diff = nbf - now;
    return {
      isExpired: false,
      isNotYetValid: true,
      expirationDate,
      notBeforeDate,
      issuedAtDate,
      statusMessage: `Token is not valid yet (nbf claim). Becomes valid in ${formatDuration(diff)}.`,
      statusVariant: "not-yet-valid",
    };
  }

  if (exp) {
    if (now > exp) {
      const diff = now - exp;
      return {
        isExpired: true,
        isNotYetValid: false,
        expirationDate,
        notBeforeDate,
        issuedAtDate,
        timeSinceExpiration: formatDuration(diff),
        statusMessage: `Token expired ${formatDuration(diff)} ago on ${expirationDate?.toLocaleDateString()} at ${expirationDate?.toLocaleTimeString()}.`,
        statusVariant: "expired",
      };
    } else {
      const diff = exp - now;
      return {
        isExpired: false,
        isNotYetValid: false,
        expirationDate,
        notBeforeDate,
        issuedAtDate,
        timeUntilExpiration: formatDuration(diff),
        statusMessage: `Token is active. Expires in ${formatDuration(diff)} on ${expirationDate?.toLocaleDateString()} at ${expirationDate?.toLocaleTimeString()}.`,
        statusVariant: "active",
      };
    }
  }

  return {
    isExpired: false,
    isNotYetValid: false,
    issuedAtDate,
    statusMessage: "Token has no expiration time (exp claim is missing).",
    statusVariant: "no-expiry",
  };
}

/**
 * Extracts standard registered claims into human-friendly explanations.
 */
export function extractStandardClaims(payload: JwtPayload): JwtClaimSummary[] {
  const claims: JwtClaimSummary[] = [];

  if (payload.iss !== undefined) {
    claims.push({
      name: "Issuer",
      key: "iss",
      value: String(payload.iss),
      description: "Identifies the principal that issued the JWT.",
    });
  }

  if (payload.sub !== undefined) {
    claims.push({
      name: "Subject",
      key: "sub",
      value: String(payload.sub),
      description: "Identifies the principal that is the subject of the JWT.",
    });
  }

  if (payload.aud !== undefined) {
    claims.push({
      name: "Audience",
      key: "aud",
      value: Array.isArray(payload.aud) ? payload.aud.join(", ") : String(payload.aud),
      description: "Identifies the recipients that the JWT is intended for.",
    });
  }

  if (payload.exp !== undefined) {
    claims.push({
      name: "Expiration Time",
      key: "exp",
      value: formatUnixDate(Number(payload.exp)),
      description: "Identifies the expiration time on or after which the JWT must not be accepted.",
    });
  }

  if (payload.nbf !== undefined) {
    claims.push({
      name: "Not Before",
      key: "nbf",
      value: formatUnixDate(Number(payload.nbf)),
      description: "Identifies the time before which the JWT must not be accepted for processing.",
    });
  }

  if (payload.iat !== undefined) {
    claims.push({
      name: "Issued At",
      key: "iat",
      value: formatUnixDate(Number(payload.iat)),
      description: "Identifies the time at which the JWT was issued.",
    });
  }

  if (payload.jti !== undefined) {
    claims.push({
      name: "JWT ID",
      key: "jti",
      value: String(payload.jti),
      description: "Provides a unique identifier for the JWT.",
    });
  }

  return claims;
}

/**
 * Parses and decodes a raw JWT string into header, payload, and signature components.
 */
export function decodeJwt(rawToken: string): JwtDecodeResult {
  const trimmed = rawToken.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Input is empty. Please enter a JSON Web Token.",
    };
  }

  // Remove potential "Bearer " prefix if user pasted Authorization header
  const token = trimmed.replace(/^bearer\s+/i, "");

  const parts = token.split(".");
  if (parts.length < 2 || parts.length > 3) {
    return {
      isValid: false,
      error: `Invalid JWT format. A valid JWT consists of 2 or 3 dot-separated segments. Received ${parts.length} segment${parts.length === 1 ? "" : "s"}.`,
    };
  }

  const [rawHeader, rawPayload, rawSignature] = parts;

  let header: JwtHeader;
  let payload: JwtPayload;

  try {
    const decodedHeaderJson = decodeBase64Url(rawHeader);
    header = JSON.parse(decodedHeaderJson);
  } catch (err) {
    return {
      isValid: false,
      error: `Failed to decode JWT header: ${err instanceof Error ? err.message : "Invalid Base64URL or JSON syntax."}`,
    };
  }

  try {
    const decodedPayloadJson = decodeBase64Url(rawPayload);
    payload = JSON.parse(decodedPayloadJson);
  } catch (err) {
    return {
      isValid: false,
      error: `Failed to decode JWT payload: ${err instanceof Error ? err.message : "Invalid Base64URL or JSON syntax."}`,
    };
  }

  const formattedHeader = JSON.stringify(header, null, 2);
  const formattedPayload = JSON.stringify(payload, null, 2);
  const expirationInfo = evaluateJwtExpiration(payload);
  const standardClaims = extractStandardClaims(payload);

  return {
    isValid: true,
    rawHeader,
    rawPayload,
    rawSignature: rawSignature || "",
    header,
    payload,
    formattedHeader,
    formattedPayload,
    expirationInfo,
    standardClaims,
  };
}

/**
 * Generates an active sample JWT with expiration set 24 hours into the future.
 */
export function getSampleActiveJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: "user_74829104",
    name: "Alex Morgan",
    email: "alex.morgan@fileforge.io",
    role: "Lead Architect",
    permissions: ["tools:execute", "export:unlimited", "offline:sync"],
    iss: "https://auth.fileforge.io",
    aud: "https://fileforge.io/api",
    iat: now,
    exp: now + 86400, // 24 hours from now
  };

  const toB64Url = (obj: object) =>
    btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const sig = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  return `${toB64Url(header)}.${toB64Url(payload)}.${sig}`;
}

/**
 * Generates an expired sample JWT with expiration set 3 days in the past.
 */
export function getSampleExpiredJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: "key_v2_2024" };
  const payload = {
    sub: "user_10293847",
    name: "Jordan Lee",
    email: "jordan.lee@example.com",
    role: "Free Tier",
    iss: "https://accounts.example.com",
    aud: "https://api.example.com",
    iat: now - 345600, // 4 days ago
    exp: now - 259200, // 3 days ago (expired)
  };

  const toB64Url = (obj: object) =>
    btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const sig = "TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ";
  return `${toB64Url(header)}.${toB64Url(payload)}.${sig}`;
}
