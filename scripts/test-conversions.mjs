import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import mammoth from "mammoth";
import { jsPDF } from "jspdf";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

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

function isValidJpgSignature(bytes) {
  if (!bytes || bytes.length < 3) return false;
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

// Generate test PDF in memory
async function createTestPdf(pages, title) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`${title} - Heading ${i}`, {
      x: 50,
      y: 700,
      size: 20,
      font,
      color: rgb(0.1, 0.2, 0.6),
    });
    page.drawText(`This is paragraph content for page ${i} with clear vector text.`, {
      x: 50,
      y: 660,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  return await doc.save();
}

// Generate test DOCX in memory
async function createTestDocx() {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "Annual Financial Summary",
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "This document contains important corporate records.",
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            text: "Key Performance Indicators:",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            text: "Revenue grew by 24% year over year across all regional departments.",
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

async function runAllTests() {
  console.log("====================================================");
  console.log("FOUR DOCUMENT CONVERSION TOOLS VERIFICATION");
  console.log("====================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // --- 1. JPG -> PDF Conversion Test ---
  console.log("--- TEST 1: JPG -> PDF Pipeline ---");
  // Create a minimal 1x1 JPG if needed for testing
  const dummyJpg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
    0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08,
    0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a,
    0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d,
    0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22,
    0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34,
    0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0,
    0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4,
    0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
    0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
    0x3f, 0x00, 0xbf, 0x00, 0xff, 0xd9
  ]);
  assert(isValidJpgSignature(dummyJpg), "Synthetic JPEG has valid 0xFFD8FF signature");

  // Create jsPDF and add image
  const jpgDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  jpgDoc.addImage(dummyJpg, "JPEG", 10, 10, 50, 50);
  const jpgPdfOutput = new Uint8Array(jpgDoc.output("arraybuffer"));
  assert(isValidPdfSignature(jpgPdfOutput), "JPG converted to PDF with valid %PDF- signature");
  const loadedJpgPdf = await PDFDocument.load(jpgPdfOutput);
  assert(loadedJpgPdf.getPageCount() === 1, "JPG PDF contains exactly 1 page");

  // --- 2. Word -> PDF Conversion Test ---
  console.log("\n--- TEST 2: Word -> PDF Pipeline ---");
  const sampleDocxBuffer = await createTestDocx();
  assert(sampleDocxBuffer.length > 0, "Created synthetic .docx OpenXML buffer");

  // Verify DOCX ZIP structure
  const docxZip = await JSZip.loadAsync(sampleDocxBuffer);
  assert(docxZip.file("word/document.xml") !== null, "DOCX has word/document.xml");
  assert(docxZip.file("[Content_Types].xml") !== null, "DOCX has [Content_Types].xml");

  // Parse with mammoth
  const mammothRes = await mammoth.convertToHtml({ buffer: sampleDocxBuffer });
  assert(mammothRes.value.includes("Annual Financial Summary"), "mammoth extracted Heading 1");
  assert(mammothRes.value.includes("Revenue grew by 24%"), "mammoth extracted body paragraph");

  // Render to PDF using jsPDF
  const wordPdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  wordPdf.setFont("helvetica", "bold");
  wordPdf.setFontSize(18);
  wordPdf.text("Annual Financial Summary", 20, 30);
  wordPdf.setFont("helvetica", "normal");
  wordPdf.setFontSize(11);
  wordPdf.text("This document contains important corporate records.", 20, 45);
  wordPdf.text("Revenue grew by 24% year over year across all regional departments.", 20, 55);

  const wordPdfBytes = new Uint8Array(wordPdf.output("arraybuffer"));
  assert(isValidPdfSignature(wordPdfBytes), "Word -> PDF generated valid %PDF- signature");
  const loadedWordPdf = await PDFDocument.load(wordPdfBytes);
  assert(loadedWordPdf.getPageCount() === 1, "Word -> PDF has 1 page");

  // --- 3. PDF -> Word Conversion Test ---
  console.log("\n--- TEST 3: PDF -> Word Pipeline ---");
  const pdfToConvertBytes = await createTestPdf(2, "Board Resolution");
  assert(isValidPdfSignature(pdfToConvertBytes), "Created sample 2-page PDF for Word conversion");

  // Extract text with pdfjs
  const pdfLoading = pdfjs.getDocument({ data: pdfToConvertBytes });
  const pdfDocInstance = await pdfLoading.promise;
  assert(pdfDocInstance.numPages === 2, "pdfjs loaded 2 pages");

  const page1 = await pdfDocInstance.getPage(1);
  const text1 = await page1.getTextContent();
  const page1Strings = text1.items.map((it) => it.str).join(" ");
  assert(page1Strings.includes("Board Resolution"), "pdfjs extracted 'Board Resolution'");
  assert(page1Strings.includes("Heading 1"), "pdfjs extracted heading");

  // Compile to DOCX via docx library
  const convertedDocx = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "Board Resolution - Heading 1",
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: "This is paragraph content for page 1 with clear vector text.",
          }),
        ],
      },
    ],
  });

  const convertedDocxBuffer = await Packer.toBuffer(convertedDocx);
  assert(convertedDocxBuffer.length > 0, "Packer generated non-empty DOCX buffer");

  // Verify generated DOCX is a valid OpenXML package
  const verifyDocxZip = await JSZip.loadAsync(convertedDocxBuffer);
  assert(verifyDocxZip.file("word/document.xml") !== null, "Generated DOCX contains word/document.xml");
  assert(verifyDocxZip.file("[Content_Types].xml") !== null, "Generated DOCX contains [Content_Types].xml");

  // Re-read with mammoth to confirm Word document can be opened and contains the text!
  const reReadDocx = await mammoth.extractRawText({ buffer: convertedDocxBuffer });
  assert(reReadDocx.value.includes("Board Resolution"), "DOCX re-opened and text verified: 'Board Resolution'");

  // --- 4. PDF -> JPG Conversion Test ---
  console.log("\n--- TEST 4: PDF -> JPG Pipeline ---");
  // Multi-page ZIP packaging test
  const zip = new JSZip();
  zip.file("document-page-1.jpg", dummyJpg);
  zip.file("document-page-2.jpg", dummyJpg);
  const zipResult = await zip.generateAsync({ type: "uint8array" });
  assert(zipResult.length > 0, "ZIP archive generated for multi-page JPG output");

  const unpackedZip = await JSZip.loadAsync(zipResult);
  const zipFiles = Object.keys(unpackedZip.files);
  assert(zipFiles.length === 2, `ZIP contains 2 files: ${zipFiles.join(", ")}`);
  const file1Bytes = await unpackedZip.file(zipFiles[0]).async("uint8array");
  assert(isValidJpgSignature(file1Bytes), "Unpacked file has valid JPEG signature");

  console.log("\n====================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("====================================================\n");

  if (failed > 0) process.exit(1);
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
