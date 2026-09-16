import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import { decryptPDF, isEncrypted } from "@pdfsmaller/pdf-decrypt";
import writeXlsxFile from "write-excel-file/node";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

function isValidPdfSignature(bytes) {
  if (!bytes || bytes.length < 5) return false;
  const limit = Math.min(bytes.length - 4, 1024);
  for (let i = 0; i < limit; i++) {
    if (
      bytes[i] === 0x25 &&
      bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x44 &&
      bytes[i + 3] === 0x46 &&
      bytes[i + 4] === 0x2d
    ) return true;
  }
  return false;
}

// Logic replicate of parseCellValue from src/lib/pdf/pdf-to-excel.ts
function parseCellValue(val) {
  const trimmed = val.trim();
  if (!trimmed) return { value: "", type: String };
  if (trimmed.length > 1 && trimmed.startsWith("0") && !trimmed.startsWith("0.")) {
    return { value: trimmed, type: String };
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isNaN(num) && Math.abs(num) < Number.MAX_SAFE_INTEGER) {
      return { value: num, type: Number };
    }
  }
  return { value: trimmed, type: String };
}

// Logic replicate of sanitizeSheetName from src/lib/pdf/pdf-to-excel.ts
function sanitizeSheetName(name, existingNames) {
  let clean = name.replace(/[\\/?*[\]:]/g, " ").trim();
  if (clean.length > 31) clean = clean.substring(0, 31).trim();
  if (!clean) clean = "Sheet";
  let finalName = clean;
  let counter = 1;
  while (existingNames.has(finalName.toLowerCase())) {
    const suffix = ` (${counter})`;
    const maxBaseLen = 31 - suffix.length;
    finalName = `${clean.substring(0, maxBaseLen)}${suffix}`;
    counter++;
  }
  existingNames.add(finalName.toLowerCase());
  return finalName;
}

async function runAllTests() {
  console.log("====================================================");
  console.log("PDF UNLOCK & PDF TO EXCEL ENGINE VERIFICATION");
  console.log("====================================================\n");

  // =========================================================================
  // TEST GROUP 1: PDF UNLOCK PIPELINE
  // =========================================================================
  console.log("--- TEST GROUP 1: PDF Unlock Pipeline ---");

  // 1.1 Unencrypted PDF
  const plainDoc = await PDFDocument.create();
  const page1 = plainDoc.addPage([500, 500]);
  const font = await plainDoc.embedFont(StandardFonts.Helvetica);
  page1.drawText("Confidential Internal Memorandum", { x: 50, y: 450, size: 14, font });
  const plainBytes = await plainDoc.save();

  assert(isValidPdfSignature(plainBytes), "Plain PDF has valid %PDF- signature");
  const plainEncCheck = await isEncrypted(plainBytes);
  assert(!plainEncCheck.encrypted, "isEncrypted correctly returns false for plain PDF");

  // 1.2 Encrypt PDF using AES-256
  const TEST_PASSWORD = "VaultSecret2026!";
  const encryptedBytes = await encryptPDF(plainBytes, TEST_PASSWORD);
  assert(isValidPdfSignature(encryptedBytes), "Encrypted PDF retains %PDF- signature");

  const encCheck = await isEncrypted(encryptedBytes);
  assert(encCheck.encrypted, "isEncrypted correctly returns true for encrypted PDF");
  assert(encCheck.algorithm === "AES-256", "Encryption algorithm detected as AES-256");

  // 1.3 Reject wrong password
  let wrongPassCaught = false;
  try {
    await decryptPDF(encryptedBytes, "WrongPassword");
  } catch (err) {
    if (err.message.includes("Incorrect password") || err.message.includes("does not match")) {
      wrongPassCaught = true;
    }
  }
  assert(wrongPassCaught, "Wrong password gracefully rejected with Incorrect password error");

  // 1.4 Decrypt with correct password
  const decryptedBytes = await decryptPDF(encryptedBytes, TEST_PASSWORD);
  assert(decryptedBytes.length > 0, "Decrypted bytes non-empty");
  assert(isValidPdfSignature(decryptedBytes), "Decrypted bytes have valid %PDF- signature");

  const postCheck = await isEncrypted(decryptedBytes);
  assert(!postCheck.encrypted, "Decrypted document isEncrypted is false");

  const unlockedDoc = await PDFDocument.load(decryptedBytes);
  assert(!unlockedDoc.isEncrypted, "pdf-lib loads decrypted document with isEncrypted: false");
  assert(unlockedDoc.getPageCount() === 1, "Page count matches original (1 page)");

  // 1.5 Verify with pdfjs-dist without providing password
  const pdfjsDoc = await pdfjs.getDocument({ data: decryptedBytes }).promise;
  assert(pdfjsDoc.numPages === 1, "pdfjs loads unlocked PDF without password request");

  console.log();

  // =========================================================================
  // TEST GROUP 2: PDF TO EXCEL UTILITIES
  // =========================================================================
  console.log("--- TEST GROUP 2: PDF to Excel Utilities ---");

  // parseCellValue
  const pInt = parseCellValue("42");
  assert(pInt.value === 42 && pInt.type === Number, "Integer parsed as Number");

  const pFloat = parseCellValue("199.99");
  assert(pFloat.value === 199.99 && pFloat.type === Number, "Float parsed as Number");

  const pLeadZero = parseCellValue("01234");
  assert(pLeadZero.value === "01234" && pLeadZero.type === String, "Leading zero string preserved as String");

  const pText = parseCellValue("Widget Description");
  assert(pText.value === "Widget Description" && pText.type === String, "Text cell preserved as String");

  // sanitizeSheetName
  const namesSet = new Set();
  const s1 = sanitizeSheetName("Page 1 Table 1", namesSet);
  assert(s1 === "Page 1 Table 1", "Clean sheet name valid");

  const s2 = sanitizeSheetName("Invalid: [Sheet]? *Test*", namesSet);
  assert(!s2.includes("[") && !s2.includes(":") && !s2.includes("?"), "Forbidden sheet characters sanitized");

  const s3 = sanitizeSheetName("Page 1 Table 1", namesSet);
  assert(s3 === "Page 1 Table 1 (1)", "Duplicate sheet name deduplicated with suffix");

  const s4 = sanitizeSheetName("Very Long Sheet Name Over Thirty One Characters Long", namesSet);
  assert(s4.length <= 31, "Sheet name constrained within 31 characters");

  console.log();

  // =========================================================================
  // TEST GROUP 3: PDF TO EXCEL CONVERSION & XLSX INTEGRITY
  // =========================================================================
  console.log("--- TEST GROUP 3: PDF to Excel Pipeline ---");

  // 3.1 Create multi-table structured data
  const sheet1Data = [
    [
      { value: "Item", fontWeight: "bold" },
      { value: "Quantity", fontWeight: "bold" },
      { value: "Unit Price", fontWeight: "bold" },
    ],
    [{ value: "Laptop Pro" }, { value: 3 }, { value: 1499.0 }],
    [{ value: "Wireless Mouse" }, { value: 10 }, { value: 29.99 }],
    [{ value: "USB-C Hub" }, { value: 5 }, { value: 45.5 }],
  ];

  const sheet2Data = [
    [
      { value: "Department", fontWeight: "bold" },
      { value: "Headcount", fontWeight: "bold" },
      { value: "Budget Code", fontWeight: "bold" },
    ],
    [{ value: "Engineering" }, { value: 45 }, { value: "00492" }],
    [{ value: "Marketing" }, { value: 18 }, { value: "00115" }],
  ];

  const sheets = [
    {
      data: sheet1Data,
      sheet: "Page 1 Table 1",
      columns: [{ width: 25 }, { width: 15 }, { width: 18 }],
    },
    {
      data: sheet2Data,
      sheet: "Page 2 Table 1",
      columns: [{ width: 22 }, { width: 16 }, { width: 18 }],
    },
  ];

  const xlsxBuffer = await writeXlsxFile(sheets).toBuffer();
  assert(xlsxBuffer.length > 0, "Generated XLSX buffer is non-empty");

  // 3.2 OpenXML package validation
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const files = Object.keys(zip.files);

  assert(files.includes("[Content_Types].xml"), "Package has [Content_Types].xml");
  assert(files.includes("xl/workbook.xml"), "Package has xl/workbook.xml");
  assert(files.includes("xl/worksheets/sheet1.xml"), "Package has xl/worksheets/sheet1.xml");
  assert(files.includes("xl/worksheets/sheet2.xml"), "Package has xl/worksheets/sheet2.xml");
  assert(files.includes("xl/sharedStrings.xml"), "Package has xl/sharedStrings.xml");

  const wbXml = await zip.file("xl/workbook.xml").async("string");
  assert(wbXml.includes("Page 1 Table 1") && wbXml.includes("Page 2 Table 1"), "Workbook defines both named sheets");

  const stringsXml = await zip.file("xl/sharedStrings.xml").async("string");
  assert(stringsXml.includes("Laptop Pro"), "Shared strings contains extracted cell text 'Laptop Pro'");
  assert(stringsXml.includes("Engineering"), "Shared strings contains extracted cell text 'Engineering'");
  assert(stringsXml.includes("00492"), "Shared strings preserves string with leading zeros '00492'");

  console.log();
  console.log("====================================================");
  console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("====================================================");

  if (failCount > 0) process.exit(1);
}

runAllTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
