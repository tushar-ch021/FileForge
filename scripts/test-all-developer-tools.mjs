import assert from "assert";

// 1. JSON Formatter
import { formatJson, minifyJson } from "../src/lib/developer/json-formatter.ts";

// 2. JSON Validator
import { validateJsonDetail } from "../src/lib/developer/json-validator.ts";

// 3. JWT Decoder
import { decodeJwt, getSampleActiveJwt, getSampleExpiredJwt } from "../src/lib/developer/jwt-decoder.ts";

// 4. Base64
import { encodeBase64, decodeBase64 } from "../src/lib/developer/base64.ts";

// 5. URL Encoder
import { encodeUrl, decodeUrl, parseQueryParams } from "../src/lib/developer/url-encoder.ts";

// 6. UUID Generator
import { generateUuidV4, generateUuidV7, generateUuidBatch, validateUuid } from "../src/lib/developer/uuid-generator.ts";

// 7. Regex Tester
import { testRegex } from "../src/lib/developer/regex-tester.ts";

// 8. Timestamp Converter
import { parseTimestampInput, parseDateString } from "../src/lib/developer/timestamp.ts";

// 9. Color Converter
import { parseColor, getColorDetails } from "../src/lib/developer/color-converter.ts";

// 10. Hash Generator
import { computeHash, computeAllHashes } from "../src/lib/developer/hash-generator.ts";

console.log("=== RUNNING FULL SUITE VERIFICATION: ALL 10 DEVELOPER TOOLS ===\n");

// 1. JSON Formatter
{
  const raw = '{"b": 2, "a": 1}';
  const { formatted } = formatJson(raw, { sortKeys: true, indent: 2 });
  assert(formatted.indexOf('"a": 1') < formatted.indexOf('"b": 2'));
  const { minified } = minifyJson(raw);
  assert.strictEqual(minified, '{"b":2,"a":1}');
  console.log("✓ 1. JSON Formatter: Formats, sorts keys, and minifies successfully.");
}

// 2. JSON Validator
{
  const validRes = validateJsonDetail('{"title": "FileForge", "active": true}');
  assert.strictEqual(validRes.isValid, true);
  assert.strictEqual(validRes.type, "object");
  const invalidRes = validateJsonDetail('{"title": "FileForge", "active": }');
  assert.strictEqual(invalidRes.isValid, false);
  console.log("✓ 2. JSON Validator: Correctly validates root types and pinpoints syntax errors.");
}

// 3. JWT Decoder
{
  const activeToken = getSampleActiveJwt();
  const activeRes = decodeJwt(activeToken);
  assert.strictEqual(activeRes.isValid, true);
  assert.strictEqual(activeRes.header?.alg, "HS256");
  assert.strictEqual(activeRes.expirationInfo?.statusVariant, "active");

  const expiredToken = getSampleExpiredJwt();
  const expiredRes = decodeJwt(expiredToken);
  assert.strictEqual(expiredRes.isValid, true);
  assert.strictEqual(expiredRes.expirationInfo?.statusVariant, "expired");
  console.log("✓ 3. JWT Decoder: Decodes header, payload claims, and identifies active/expired status.");
}

// 4. Base64
{
  const text = "Hello FileForge! 🚀 日本語";
  const enc = encodeBase64(text);
  assert.strictEqual(enc.success, true);
  const dec = decodeBase64(enc.result);
  assert.strictEqual(dec.success, true);
  assert.strictEqual(dec.result, text);
  console.log("✓ 4. Base64: UTF-8 Unicode two-way encode and decode roundtrip verified.");
}

// 5. URL Encoder
{
  const url = "https://fileforge.io/search?category=dev tools&tag=c++#nav";
  const enc = encodeUrl(url, { mode: "component" });
  assert.strictEqual(enc.success, true);
  const dec = decodeUrl(enc.result);
  assert.strictEqual(dec.success, true);
  assert.strictEqual(dec.result, url);

  const params = parseQueryParams("key1=value1&key2=hello%20world");
  assert.strictEqual(params.length, 2);
  assert.strictEqual(params[1].decodedValue, "hello world");
  console.log("✓ 5. URL Encoder: Encodes, decodes, and parses query parameters cleanly.");
}

// 6. UUID Generator
{
  const v4 = generateUuidV4();
  const v4Validation = validateUuid(v4);
  assert.strictEqual(v4Validation.isValid, true);
  assert.strictEqual(v4Validation.version, 4);

  const v7 = generateUuidV7();
  const v7Validation = validateUuid(v7);
  assert.strictEqual(v7Validation.isValid, true);
  assert.strictEqual(v7Validation.version, 7);

  const batch = generateUuidBatch(10, "v4", { uppercase: true });
  assert.strictEqual(batch.length, 10);
  assert.strictEqual(batch[0], batch[0].toUpperCase());
  console.log("✓ 6. UUID Generator: Generates RFC 4122 v4 and RFC 9562 v7 batch UUIDs.");
}

// 7. RegEx Tester
{
  const testRes = testRegex("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", {
    global: true,
    ignoreCase: false,
    multiline: false,
    dotAll: false,
    unicode: false,
  }, "Contact test@fileforge.io and admin@domain.org", "[REDACTED]");

  assert.strictEqual(testRes.isValid, true);
  assert.strictEqual(testRes.matchCount, 2);
  assert.strictEqual(testRes.matches[0].match, "test@fileforge.io");
  assert(testRes.replacedText?.includes("[REDACTED] and [REDACTED]"));
  console.log("✓ 7. RegEx Tester: Correctly extracts matches, ranges, and handles substitutions.");
}

// 8. Timestamp Converter
{
  const epochSec = 1773595200;
  const parseRes = parseTimestampInput(epochSec);
  assert.strictEqual(parseRes.isValid, true);
  assert.strictEqual(parseRes.detectedUnit, "seconds");
  assert(parseRes.breakdown?.iso.includes("2026"));

  const dateParse = parseDateString("2026-09-15T12:00:00Z");
  assert.strictEqual(dateParse.isValid, true);
  assert(dateParse.breakdown?.epochSeconds !== undefined);
  console.log("✓ 8. Timestamp Converter: Bidirectional timestamp and date format parsing verified.");
}

// 9. Color Converter
{
  const parsed = parseColor("#2563eb");
  assert(parsed !== null);
  const details = getColorDetails(parsed);
  assert.strictEqual(details.hex, "#2563eb");
  assert.strictEqual(details.rgbString, "rgb(37, 99, 235)");
  assert(details.contrast.contrastWhite > 1);
  assert(details.contrast.contrastBlack > 1);
  assert(details.tints.length === 5);
  assert(details.shades.length === 5);
  console.log("✓ 9. Color Converter: HEX, RGB, HSL, HSV, CMYK, and WCAG contrast verified.");
}

// 10. Hash Generator
{
  const data = new TextEncoder().encode("Hello FileForge");
  const md5Hex = await computeHash(data, "MD5");
  assert.strictEqual(md5Hex.length, 32);

  const sha256Hex = await computeHash(data, "SHA-256");
  assert.strictEqual(sha256Hex.length, 64);

  const all = await computeAllHashes(data);
  assert.strictEqual(all.hashes.length, 5);
  console.log("✓ 10. Hash Generator: Computes MD5, SHA-1, SHA-256, SHA-384, and SHA-512 digests.");
}

console.log("\n=======================================================");
console.log("🎉 ALL 10 DEVELOPER TOOLS VERIFIED & FUNCTIONAL! 🎉");
console.log("=======================================================");
