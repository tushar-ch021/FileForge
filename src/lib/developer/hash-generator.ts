/**
 * Pure cryptographic hashing engine supporting SHA-1, SHA-256, SHA-384, SHA-512, and MD5.
 * Uses native browser Web Crypto API (crypto.subtle) where available.
 * 100% in-browser client-side execution.
 */

export type HashAlgorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export interface HashOutputOptions {
  uppercase?: boolean;
  format?: "hex" | "base64";
}

export interface HashResultItem {
  algorithm: HashAlgorithm;
  bits: number;
  hash: string;
}

export interface MultiHashResult {
  hashes: HashResultItem[];
  executionTimeMs: number;
}

/**
 * Clean, lightweight RFC 1321 MD5 implementation in pure JavaScript.
 */
function md5(inputBytes: Uint8Array): Uint8Array {
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }

  function bitRotateLeft(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt));
  }

  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  // Convert Uint8Array to 32-bit words with padding
  const length = inputBytes.length;
  const words: number[] = [];
  for (let i = 0; i < length; i++) {
    words[i >> 2] |= inputBytes[i] << ((i % 4) * 8);
  }
  words[length >> 2] |= 0x80 << ((length % 4) * 8);
  words[(((length + 8) >> 6) << 4) + 14] = length * 8;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < words.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;

    a = md5ff(a, b, c, d, words[i] || 0, 7, -680876936);
    d = md5ff(d, a, b, c, words[i + 1] || 0, 12, -389564586);
    c = md5ff(c, d, a, b, words[i + 2] || 0, 17, 606105819);
    b = md5ff(b, c, d, a, words[i + 3] || 0, 22, -1044525330);
    a = md5ff(a, b, c, d, words[i + 4] || 0, 7, -176418897);
    d = md5ff(d, a, b, c, words[i + 5] || 0, 12, 1200080426);
    c = md5ff(c, d, a, b, words[i + 6] || 0, 17, -1473231341);
    b = md5ff(b, c, d, a, words[i + 7] || 0, 22, -45705983);
    a = md5ff(a, b, c, d, words[i + 8] || 0, 7, 1770035416);
    d = md5ff(d, a, b, c, words[i + 9] || 0, 12, -1958414417);
    c = md5ff(c, d, a, b, words[i + 10] || 0, 17, -42063);
    b = md5ff(b, c, d, a, words[i + 11] || 0, 22, -1990404162);
    a = md5ff(a, b, c, d, words[i + 12] || 0, 7, 1804603682);
    d = md5ff(d, a, b, c, words[i + 13] || 0, 12, -40341101);
    c = md5ff(c, d, a, b, words[i + 14] || 0, 17, -1502002290);
    b = md5ff(b, c, d, a, words[i + 15] || 0, 22, 1236535329);

    a = md5gg(a, b, c, d, words[i + 1] || 0, 5, -165796510);
    d = md5gg(d, a, b, c, words[i + 6] || 0, 9, -1069501632);
    c = md5gg(c, d, a, b, words[i + 11] || 0, 14, 643717713);
    b = md5gg(b, c, d, a, words[i] || 0, 20, -373897302);
    a = md5gg(a, b, c, d, words[i + 5] || 0, 5, -701558691);
    d = md5gg(d, a, b, c, words[i + 10] || 0, 9, 38016083);
    c = md5gg(c, d, a, b, words[i + 15] || 0, 14, -660478335);
    b = md5gg(b, c, d, a, words[i + 4] || 0, 20, -405537848);
    a = md5gg(a, b, c, d, words[i + 9] || 0, 5, 568446438);
    d = md5gg(d, a, b, c, words[i + 14] || 0, 9, -1019803690);
    c = md5gg(c, d, a, b, words[i + 3] || 0, 14, -187363961);
    b = md5gg(b, c, d, a, words[i + 8] || 0, 20, 1163531501);
    a = md5gg(a, b, c, d, words[i + 13] || 0, 5, -1444681467);
    d = md5gg(d, a, b, c, words[i + 2] || 0, 9, -51403784);
    c = md5gg(c, d, a, b, words[i + 7] || 0, 14, 1735328473);
    b = md5gg(b, c, d, a, words[i + 12] || 0, 20, -1926607734);

    a = md5hh(a, b, c, d, words[i + 5] || 0, 4, -378558);
    d = md5hh(d, a, b, c, words[i + 8] || 0, 11, -2022574463);
    c = md5hh(c, d, a, b, words[i + 11] || 0, 16, 1839030562);
    b = md5hh(b, c, d, a, words[i + 14] || 0, 23, -35309556);
    a = md5hh(a, b, c, d, words[i + 1] || 0, 4, -1530992060);
    d = md5hh(d, a, b, c, words[i + 4] || 0, 11, 1272893353);
    c = md5hh(c, d, a, b, words[i + 7] || 0, 16, -155497632);
    b = md5hh(b, c, d, a, words[i + 10] || 0, 23, -1094730640);
    a = md5hh(a, b, c, d, words[i + 13] || 0, 4, 681279174);
    d = md5hh(d, a, b, c, words[i] || 0, 11, -358537222);
    c = md5hh(c, d, a, b, words[i + 3] || 0, 16, -722521979);
    b = md5hh(b, c, d, a, words[i + 6] || 0, 23, 76029189);
    a = md5hh(a, b, c, d, words[i + 9] || 0, 4, -640364487);
    d = md5hh(d, a, b, c, words[i + 12] || 0, 11, -421815835);
    c = md5hh(c, d, a, b, words[i + 15] || 0, 16, 530742520);
    b = md5hh(b, c, d, a, words[i + 2] || 0, 23, -995338651);

    a = md5ii(a, b, c, d, words[i] || 0, 6, -198630844);
    d = md5ii(d, a, b, c, words[i + 7] || 0, 10, 1126891415);
    c = md5ii(c, d, a, b, words[i + 14] || 0, 15, -1416354905);
    b = md5ii(b, c, d, a, words[i + 5] || 0, 21, -57434055);
    a = md5ii(a, b, c, d, words[i + 12] || 0, 6, 1700485571);
    d = md5ii(d, a, b, c, words[i + 3] || 0, 10, -1894986606);
    c = md5ii(c, d, a, b, words[i + 10] || 0, 15, -1051523);
    b = md5ii(b, c, d, a, words[i + 1] || 0, 21, -2054922799);
    a = md5ii(a, b, c, d, words[i + 8] || 0, 6, 1873313359);
    d = md5ii(d, a, b, c, words[i + 15] || 0, 10, -30611744);
    c = md5ii(c, d, a, b, words[i + 6] || 0, 15, -1560198380);
    b = md5ii(b, c, d, a, words[i + 13] || 0, 21, 1309151649);
    a = md5ii(a, b, c, d, words[i + 4] || 0, 6, -145523070);
    d = md5ii(d, a, b, c, words[i + 11] || 0, 10, -1120210379);
    c = md5ii(c, d, a, b, words[i + 2] || 0, 15, 718787259);
    b = md5ii(b, c, d, a, words[i + 9] || 0, 21, -343485551);

    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  const result = new Uint8Array(16);
  const wordsOut = [a, b, c, d];
  for (let i = 0; i < 16; i++) {
    result[i] = (wordsOut[i >> 2] >> ((i % 4) * 8)) & 0xff;
  }
  return result;
}

/**
 * Formats a byte buffer into hexadecimal or base64.
 */
export function formatHashBuffer(buffer: ArrayBuffer | Uint8Array, options: HashOutputOptions = {}): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (options.format === "base64") {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  let hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  if (options.uppercase) {
    hex = hex.toUpperCase();
  }
  return hex;
}

/**
 * Computes a hash for a given algorithm using Web Crypto API or internal MD5.
 */
export async function computeHash(
  data: Uint8Array,
  algorithm: HashAlgorithm,
  options: HashOutputOptions = {}
): Promise<string> {
  if (algorithm === "MD5") {
    const digestBytes = md5(data);
    return formatHashBuffer(digestBytes, options);
  }

  // Web Crypto API algorithms
  const webCryptoAlgoMap: Record<string, string> = {
    "SHA-1": "SHA-1",
    "SHA-256": "SHA-256",
    "SHA-384": "SHA-384",
    "SHA-512": "SHA-512",
  };

  const algoName = webCryptoAlgoMap[algorithm];
  if (!algoName) {
    throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }

  const digestBuffer = await crypto.subtle.digest(algoName, data as unknown as BufferSource);
  return formatHashBuffer(digestBuffer, options);
}

/**
 * Computes all standard hashes simultaneously for a given byte buffer.
 */
export async function computeAllHashes(
  data: Uint8Array,
  options: HashOutputOptions = {}
): Promise<MultiHashResult> {
  const start = performance.now();

  const [md5Hash, sha1Hash, sha256Hash, sha384Hash, sha512Hash] = await Promise.all([
    computeHash(data, "MD5", options),
    computeHash(data, "SHA-1", options),
    computeHash(data, "SHA-256", options),
    computeHash(data, "SHA-384", options),
    computeHash(data, "SHA-512", options),
  ]);

  const executionTimeMs = parseFloat((performance.now() - start).toFixed(2));

  return {
    hashes: [
      { algorithm: "MD5", bits: 128, hash: md5Hash },
      { algorithm: "SHA-1", bits: 160, hash: sha1Hash },
      { algorithm: "SHA-256", bits: 256, hash: sha256Hash },
      { algorithm: "SHA-384", bits: 384, hash: sha384Hash },
      { algorithm: "SHA-512", bits: 512, hash: sha512Hash },
    ],
    executionTimeMs,
  };
}

/**
 * Computes HMAC digest with a secret key using Web Crypto API.
 */
export async function computeHmac(
  data: Uint8Array,
  secretKey: string,
  algorithm: "SHA-256" | "SHA-512" = "SHA-256",
  options: HashOutputOptions = {}
): Promise<string> {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(secretKey);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "HMAC", hash: { name: algorithm } },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data as unknown as BufferSource);
  return formatHashBuffer(signature, options);
}

export const SAMPLE_TEXT_HASH = "FileForge: High-performance, client-side developer tools platform.";
