import assert from "assert";
import {
  validateJson,
  formatJson,
  minifyJson,
  SAMPLE_JSON,
} from "../src/lib/developer/json-formatter.ts";

console.log("=== RUNNING JSON FORMATTER COMPREHENSIVE TESTS ===");

// 1. Valid JSON Test
{
  const valid = '{"name": "FileForge", "active": true, "count": 26}';
  const result = validateJson(valid);
  assert.strictEqual(result.isValid, true, "Valid JSON should validate successfully");
  const { formatted } = formatJson(valid, { indent: 2 });
  assert(formatted.includes('  "name": "FileForge"'), "Should format with 2 spaces");
  console.log("✓ Test 1 Passed: Valid JSON formatting");
}

// 2. Invalid JSON Test
{
  const invalid = '{"name": "FileForge", "unclosed": }';
  const result = validateJson(invalid);
  assert.strictEqual(result.isValid, false, "Invalid JSON should be flagged");
  assert(result.error !== undefined, "Should have error object");
  assert(typeof result.error.line === "number", "Should detect error line number");
  assert(typeof result.error.column === "number", "Should detect error column number");
  console.log(`✓ Test 2 Passed: Invalid JSON diagnostics (Line ${result.error.line}, Col ${result.error.column})`);
}

// 3. Empty input Test
{
  const empty = "   ";
  const result = validateJson(empty);
  assert.strictEqual(result.isValid, false, "Empty input should not be valid");
  assert(result.error?.message.includes("empty"), "Should state input is empty");
  console.log("✓ Test 3 Passed: Empty input handling");
}

// 4. Nested objects Test
{
  const nested = '{"a": {"b": {"c": {"d": 42}}}}';
  const { formatted } = formatJson(nested, { indent: 2 });
  assert(formatted.includes('        "d": 42'), "Deep nesting indentation should be accurate");
  console.log("✓ Test 4 Passed: Deeply nested objects");
}

// 5. Arrays Test
{
  const arr = '[1, "two", {"three": 3}, [4, 5]]';
  const { formatted } = formatJson(arr, { indent: 4 });
  assert(formatted.includes('        "three": 3'), "Array nesting indentation should be accurate");
  console.log("✓ Test 5 Passed: Arrays and nested arrays");
}

// 6. Strings containing escaped characters Test
{
  const escaped = '{"quote": "He said \\"Hello\\"", "newline": "Line 1\\nLine 2", "tab": "\\tTabbed"}';
  const result = validateJson(escaped);
  assert.strictEqual(result.isValid, true, "Escaped characters should parse cleanly");
  const { formatted } = formatJson(escaped, { indent: 2 });
  assert(formatted.includes('\\"Hello\\"'), "Escaped quotes must be preserved");
  console.log("✓ Test 6 Passed: Strings with escaped quotes and newlines");
}

// 7. Unicode Test
{
  const unicode = '{"greeting": "Hello 🌍 World 🚀", "japanese": "こんにちは世界", "arabic": "مرحبا بالعالم"}';
  const result = validateJson(unicode);
  assert.strictEqual(result.isValid, true, "Unicode characters should parse without distortion");
  const { formatted, stats } = formatJson(unicode);
  assert(formatted.includes("🚀"), "Emojis must be preserved");
  assert(formatted.includes("こんにちは世界"), "CJK characters must be preserved");
  assert(stats.byteSize > stats.charCount, "Byte size calculation must account for multi-byte UTF-8");
  console.log(`✓ Test 7 Passed: Unicode & emoji integrity (Chars: ${stats.charCount}, UTF-8 Bytes: ${stats.byteSize})`);
}

// 8. Large JSON Test
{
  const largeArray = [];
  for (let i = 0; i < 5000; i++) {
    largeArray.push({
      id: i,
      guid: `item-${i}-${Math.random().toString(36).substring(7)}`,
      status: i % 2 === 0 ? "active" : "pending",
      tags: ["tag1", "tag2", "tag3"],
    });
  }
  const largeJson = JSON.stringify(largeArray);
  const start = performance.now();
  const { formatted, stats } = formatJson(largeJson, { indent: 2 });
  const duration = performance.now() - start;
  assert(formatted.length > 0 && stats.lineCount > 30000, "Large JSON should have over 30,000 formatted lines");
  console.log(`✓ Test 8 Passed: Large JSON (5,000 items, ${stats.lineCount} lines, ${stats.byteSize} bytes processed in ${duration.toFixed(1)}ms)`);
}

// 9. Minification Test
{
  const pretty = `
  {
    "alpha": 1,
    "beta": [2, 3, 4],
    "gamma": {
      "delta": "test"
    }
  }
  `;
  const { minified, stats } = minifyJson(pretty);
  assert.strictEqual(minified, '{"alpha":1,"beta":[2,3,4],"gamma":{"delta":"test"}}');
  assert.strictEqual(stats.lineCount, 1, "Minified output should be exactly 1 line");
  console.log("✓ Test 9 Passed: Minification to 1 line compact JSON");
}

// 10. Key Sorting Test
{
  const unsorted = '{"z": 1, "a": 2, "m": {"b": 3, "a": 4}}';
  const { formatted } = formatJson(unsorted, { indent: 2, sortKeys: true });
  const aIdx = formatted.indexOf('"a": 2');
  const zIdx = formatted.indexOf('"z": 1');
  assert(aIdx < zIdx, "Keys should be sorted alphabetically");
  console.log("✓ Test 10 Passed: Alphabetical key sorting (A-Z)");
}

// 11. Sample JSON Test
{
  const validation = validateJson(SAMPLE_JSON);
  assert.strictEqual(validation.isValid, true, "Sample JSON must be valid");
  console.log("✓ Test 11 Passed: Built-in sample payload validity");
}

console.log("\n=== ALL 11 PROCESSING LAYER TEST CASES PASSED SUCCESSFULLY ===");
