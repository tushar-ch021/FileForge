import assert from "assert";
import {
  validateJsonDetail,
  getFormattedPreview,
  SAMPLE_VALID_OBJECT,
  SAMPLE_VALID_ARRAY,
  SAMPLE_INVALID_JSON,
} from "../src/lib/developer/json-validator.ts";

console.log("=== RUNNING JSON VALIDATOR COMPREHENSIVE TESTS ===");

// 1. Valid Object Test
{
  const obj = '{"id": 101, "name": "FileForge", "active": true}';
  const res = validateJsonDetail(obj);
  assert.strictEqual(res.isValid, true, "Valid object must be valid");
  assert.strictEqual(res.type, "object", "Root type should be object");
  assert.strictEqual(res.itemCount, 3, "Should count 3 root keys");
  console.log("✓ Test 1 Passed: Valid Object validation");
}

// 2. Valid Array Test
{
  const arr = '["apple", "banana", "cherry"]';
  const res = validateJsonDetail(arr);
  assert.strictEqual(res.isValid, true, "Valid array must be valid");
  assert.strictEqual(res.type, "array", "Root type should be array");
  assert.strictEqual(res.itemCount, 3, "Should count 3 array items");
  console.log("✓ Test 2 Passed: Valid Array validation");
}

// 3. Nested JSON Test
{
  const nested = '{"level1": {"level2": {"level3": [1, 2, {"level5": "deep"}]}}}';
  const res = validateJsonDetail(nested);
  assert.strictEqual(res.isValid, true, "Nested JSON must be valid");
  assert(res.depth && res.depth >= 5, `Depth should be at least 5, got ${res.depth}`);
  console.log(`✓ Test 3 Passed: Nested JSON structure (Depth: ${res.depth})`);
}

// 4. Invalid JSON Test
{
  const invalid = '{"unclosed": "string';
  const res = validateJsonDetail(invalid);
  assert.strictEqual(res.isValid, false, "Invalid JSON must fail validation");
  assert(res.error?.message, "Must return useful error message");
  console.log(`✓ Test 4 Passed: Invalid JSON diagnostics (${res.error?.message})`);
}

// 5. Empty Input Test
{
  const empty = "   \n\t  ";
  const res = validateJsonDetail(empty);
  assert.strictEqual(res.isValid, false, "Empty input must be invalid");
  assert.strictEqual(res.type, "empty");
  assert(res.error?.message.includes("empty"), "Must mention empty input");
  console.log("✓ Test 5 Passed: Empty input handling");
}

// 6. Primitive JSON values (string, number, boolean, null)
{
  assert.strictEqual(validateJsonDetail('"simple string"').type, "string");
  assert.strictEqual(validateJsonDetail('42.5').type, "number");
  assert.strictEqual(validateJsonDetail('true').type, "boolean");
  assert.strictEqual(validateJsonDetail('null').type, "null");
  console.log("✓ Test 6 Passed: Valid RFC 8259 primitive root values (string, number, boolean, null)");
}

// 7. Unicode & Emoji Integrity Test
{
  const unicode = '{"emoji": "✨🚀🔥", "cjk": "ファイルフォージ", "accented": "éxitos"}';
  const res = validateJsonDetail(unicode);
  assert.strictEqual(res.isValid, true, "Unicode JSON must parse cleanly");
  const formatted = getFormattedPreview(unicode, 2);
  assert(formatted.includes("🚀"), "Emojis must be preserved");
  assert(formatted.includes("ファイルフォージ"), "CJK characters must be preserved");
  console.log("✓ Test 7 Passed: Unicode & multi-byte character fidelity");
}

// 8. Large JSON Performance Test
{
  const largeObj = {};
  for (let i = 0; i < 5000; i++) {
    largeObj[`key_${i}`] = { index: i, square: i * i, active: i % 2 === 0 };
  }
  const largeJson = JSON.stringify(largeObj);
  const start = performance.now();
  const res = validateJsonDetail(largeJson);
  const duration = performance.now() - start;
  assert.strictEqual(res.isValid, true, "Large JSON must validate");
  assert.strictEqual(res.itemCount, 5000, "Should count 5000 keys");
  console.log(`✓ Test 8 Passed: Large JSON (5,000 keys validated in ${duration.toFixed(1)}ms)`);
}

// 9. Formatting Indentation Tests (2 spaces, 4 spaces, Tab)
{
  const raw = '{"a":1,"b":2}';
  const f2 = getFormattedPreview(raw, 2);
  const f4 = getFormattedPreview(raw, 4);
  const fTab = getFormattedPreview(raw, "tab");

  assert(f2.includes('  "a": 1'), "Must indent with 2 spaces");
  assert(f4.includes('    "a": 1'), "Must indent with 4 spaces");
  assert(fTab.includes('\t"a": 1'), "Must indent with tab");
  console.log("✓ Test 9 Passed: 2-space, 4-space, and Tab formatting preview");
}

// 10. Key Sorting Test
{
  const unsorted = '{"z": 1, "a": 2, "m": 3}';
  const sorted = getFormattedPreview(unsorted, 2, true);
  const aPos = sorted.indexOf('"a": 2');
  const zPos = sorted.indexOf('"z": 1');
  assert(aPos < zPos, "Keys must be sorted A-Z");
  console.log("✓ Test 10 Passed: Alphabetical key sorting preview");
}

// 11. Sample Payloads Test
{
  assert.strictEqual(validateJsonDetail(SAMPLE_VALID_OBJECT).isValid, true);
  assert.strictEqual(validateJsonDetail(SAMPLE_VALID_ARRAY).isValid, true);
  assert.strictEqual(validateJsonDetail(SAMPLE_INVALID_JSON).isValid, false);
  console.log("✓ Test 11 Passed: Built-in sample valid and invalid payloads");
}

console.log("\n=== ALL JSON VALIDATOR TESTS PASSED SUCCESSFULLY ===");
