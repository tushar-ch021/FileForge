import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import JSZip from "jszip";

// Core utility functions mirroring src/lib/pdf/common.ts
function isValidPdfSignature(bytes) {
  if (!bytes || bytes.length < 5) return false;
  const limit = Math.min(bytes.length - 4, 1024);
  for (let i = 0; i < limit; i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }
  return false;
}

function extractPdfVersion(bytes) {
  try {
    const header = new TextDecoder("latin1").decode(bytes.subarray(0, 32));
    const match = header.match(/%PDF-(\d+\.\d+)/);
    if (match) return `PDF ${match[1]}`;
  } catch {}
  return "PDF 1.5+";
}

// Range parser mirroring src/lib/pdf/split-pdf.ts
function parsePageRanges(rangeStr, totalPages) {
  const trimmed = rangeStr.trim();
  if (!trimmed) {
    return { isValid: false, groups: [], allPageNumbers: [], error: "Empty range" };
  }

  const rawTokens = trimmed.split(",");
  const groups = [];
  const allPagesSet = new Set();

  for (const rawToken of rawTokens) {
    const token = rawToken.trim();
    if (!token) {
      return { isValid: false, groups: [], allPageNumbers: [], error: "Empty segment" };
    }

    if (token.includes("-")) {
      const parts = token.split("-");
      if (parts.length !== 2) {
        return { isValid: false, groups: [], allPageNumbers: [], error: `Invalid range format: ${token}` };
      }

      const startStr = parts[0].trim();
      const endStr = parts[1].trim();

      if (!/^\d+$/.test(startStr) || !/^\d+$/.test(endStr)) {
        return { isValid: false, groups: [], allPageNumbers: [], error: `Non-numeric token: ${token}` };
      }

      let start = parseInt(startStr, 10);
      let end = parseInt(endStr, 10);

      if (start < 1 || end < 1) {
        return { isValid: false, groups: [], allPageNumbers: [], error: `Page below 1: ${token}` };
      }

      if (start > totalPages || end > totalPages) {
        return { isValid: false, groups: [], allPageNumbers: [], error: `Page exceeds document total (${totalPages}): ${token}` };
      }

      if (start > end) {
        const temp = start;
        start = end;
        end = temp;
      }

      const pageNumbers = [];
      const pageIndices = [];
      for (let p = start; p <= end; p++) {
        pageNumbers.push(p);
        pageIndices.push(p - 1);
        allPagesSet.add(p);
      }

      groups.push({
        originalToken: token,
        normalizedRange: `${start}-${end}`,
        pageNumbers,
        pageIndices,
      });
    } else {
      if (!/^\d+$/.test(token)) {
        return { isValid: false, groups: [], allPageNumbers: [], error: `Invalid number: ${token}` };
      }

      const page = parseInt(token, 10);
      if (page < 1) {
        return { isValid: false, groups: [], allPageNumbers: [], error: `Page below 1: ${token}` };
      }
      if (page > totalPages) {
        return { isValid: false, groups: [], allPageNumbers: [], error: `Page exceeds document total: ${token}` };
      }

      allPagesSet.add(page);
      groups.push({
        originalToken: token,
        normalizedRange: `${page}`,
        pageNumbers: [page],
        pageIndices: [page - 1],
      });
    }
  }

  const allPageNumbers = Array.from(allPagesSet).sort((a, b) => a - b);
  return { isValid: true, groups, allPageNumbers };
}

// Merge logic mirroring merge-pdf.ts
async function mergePdfBuffers(buffers) {
  const mergedDoc = await PDFDocument.create();
  let totalPages = 0;

  for (const buf of buffers) {
    if (!isValidPdfSignature(buf)) {
      throw new Error("Invalid PDF signature");
    }
    const srcDoc = await PDFDocument.load(buf);
    totalPages += srcDoc.getPageCount();
    const pageIndices = srcDoc.getPageIndices();
    const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);
    for (const page of copiedPages) {
      mergedDoc.addPage(page);
    }
  }

  const mergedBytes = await mergedDoc.save({ useObjectStreams: true });
  return { mergedBytes, totalPages };
}

// Split logic mirroring split-pdf.ts
async function splitPdfBuffer(buffer, config) {
  if (!isValidPdfSignature(buffer)) {
    throw new Error("Invalid PDF signature");
  }

  const srcDoc = await PDFDocument.load(buffer);
  const totalOriginalPages = srcDoc.getPageCount();
  const plans = [];

  if (config.mode === "selected") {
    const selected = (config.selectedPages || []).filter((p) => p >= 1 && p <= totalOriginalPages);
    const uniqueSorted = Array.from(new Set(selected)).sort((a, b) => a - b);
    plans.push({
      filename: `selected-${uniqueSorted.length}-pages.pdf`,
      pageIndices: uniqueSorted.map((p) => p - 1),
    });
  } else if (config.mode === "ranges") {
    const parsed = parsePageRanges(config.rangeString, totalOriginalPages);
    if (!parsed.isValid) throw new Error(parsed.error);
    for (const group of parsed.groups) {
      plans.push({
        filename: `pages-${group.normalizedRange}.pdf`,
        pageIndices: group.pageIndices,
      });
    }
  } else if (config.mode === "every") {
    for (let p = 1; p <= totalOriginalPages; p++) {
      plans.push({
        filename: `page-${p}.pdf`,
        pageIndices: [p - 1],
      });
    }
  }

  const generatedFiles = [];
  for (const plan of plans) {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(srcDoc, plan.pageIndices);
    for (const page of pages) doc.addPage(page);
    const bytes = await doc.save({ useObjectStreams: true });
    generatedFiles.push({ filename: plan.filename, bytes, pageCount: plan.pageIndices.length });
  }

  if (generatedFiles.length === 1) {
    return { isArchive: false, file: generatedFiles[0], files: generatedFiles };
  } else {
    const zip = new JSZip();
    for (const f of generatedFiles) {
      zip.file(f.filename, f.bytes);
    }
    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    return { isArchive: true, zipBytes, files: generatedFiles };
  }
}

// Generator for test PDFs
async function createTestPdf(pageCount, titlePrefix, options = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= pageCount; i++) {
    const isLandscape = options.orientation === "landscape";
    const width = isLandscape ? 792 : 612;
    const height = isLandscape ? 612 : 792;

    const page = doc.addPage([width, height]);
    page.drawText(`${titlePrefix} - Page ${i} of ${pageCount}`, {
      x: 50,
      y: height - 100,
      size: 20,
      font,
      color: rgb(0.1, 0.2, 0.6),
    });

    page.drawRectangle({
      x: 50,
      y: 50,
      width: width - 100,
      height: 10,
      color: rgb(0.2, 0.7, 0.3),
    });
  }

  return await doc.save();
}

async function runTests() {
  console.log("====================================================");
  console.log("PDF MERGER & SPLITTER ENGINE VERIFICATION");
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

  // TEST GROUP 1: Shared Utilities
  console.log("--- TEST GROUP 1: Signature & Headers ---");
  const samplePdf = await createTestPdf(2, "TestDoc");
  assert(isValidPdfSignature(samplePdf), "Valid %PDF- signature recognized");
  assert(!isValidPdfSignature(Buffer.from("random text")), "Invalid signature rejected");
  assert(extractPdfVersion(samplePdf).startsWith("PDF"), "PDF version extracted");

  // TEST GROUP 2: Range Parser
  console.log("\n--- TEST GROUP 2: Range Parser Verification ---");
  const totalPages = 10;
  assert(parsePageRanges("1", totalPages).isValid, "Single page '1' valid");
  assert(parsePageRanges("1, 3, 5", totalPages).isValid, "Pages '1, 3, 5' valid");
  const rMixed = parsePageRanges("1-3, 6, 8-10", totalPages);
  assert(rMixed.isValid && rMixed.groups.length === 3, "'1-3, 6, 8-10' parsed into 3 groups");
  assert(rMixed.allPageNumbers.join(",") === "1,2,3,6,8,9,10", "All targeted pages matched");

  const rRev = parsePageRanges("5-2", totalPages);
  assert(rRev.isValid && rRev.groups[0].normalizedRange === "2-5", "Reversed range '5-2' normalized to '2-5'");

  assert(!parsePageRanges("0", totalPages).isValid, "Page 0 rejected");
  assert(!parsePageRanges("11", totalPages).isValid, "Page 11 out-of-bounds rejected");
  assert(!parsePageRanges("1-3, foo", totalPages).isValid, "Non-numeric token rejected");
  assert(!parsePageRanges("", totalPages).isValid, "Empty string rejected");

  // TEST GROUP 3: Merge Execution
  console.log("\n--- TEST GROUP 3: PDF Merger Execution ---");
  const docA = await createTestPdf(2, "DocA (Portrait)");
  const docB = await createTestPdf(3, "DocB (Landscape)", { orientation: "landscape" });
  const docC = await createTestPdf(1, "DocC (Portrait)");

  const { mergedBytes, totalPages: mergedPageCount } = await mergePdfBuffers([docA, docB]);
  assert(mergedPageCount === 5, `Merge A(2) + B(3) total count is 5`);
  assert(isValidPdfSignature(mergedBytes), "Merged output has valid PDF signature");

  const loadedMerged = await PDFDocument.load(mergedBytes);
  assert(loadedMerged.getPageCount() === 5, "Loaded merged document has exactly 5 pages");
  const p1 = loadedMerged.getPage(0);
  const p3 = loadedMerged.getPage(2);
  assert(p1.getWidth() === 612 && p1.getHeight() === 792, "Page 1 dimensions preserved (portrait)");
  assert(p3.getWidth() === 792 && p3.getHeight() === 612, "Page 3 dimensions preserved (landscape)");

  // Merge 3 docs: C + A + B = 1 + 2 + 3 = 6
  const { totalPages: threeMergePages } = await mergePdfBuffers([docC, docA, docB]);
  assert(threeMergePages === 6, "Merge C(1) + A(2) + B(3) total count is 6");

  // TEST GROUP 4: Split Execution
  console.log("\n--- TEST GROUP 4: PDF Splitter Execution ---");
  // Mode 1: Selected pages
  const split1 = await splitPdfBuffer(docB, { mode: "selected", selectedPages: [1, 3] });
  assert(!split1.isArchive, "Selected pages mode outputs single PDF");
  const loadedSplit1 = await PDFDocument.load(split1.file.bytes);
  assert(loadedSplit1.getPageCount() === 2, "Selected pages output has 2 pages");

  // Mode 2: Single Range
  const splitRange1 = await splitPdfBuffer(docB, { mode: "ranges", rangeString: "1-2" });
  assert(!splitRange1.isArchive, "Single range outputs single PDF");
  const loadedSplitRange1 = await PDFDocument.load(splitRange1.file.bytes);
  assert(loadedSplitRange1.getPageCount() === 2, "Single range output has 2 pages");

  // Mode 2: Multiple Ranges
  const splitRangeMulti = await splitPdfBuffer(docB, { mode: "ranges", rangeString: "1-2, 3" });
  assert(splitRangeMulti.isArchive, "Multiple ranges outputs ZIP archive");
  assert(splitRangeMulti.files.length === 2, "2 PDFs created for 2 ranges");
  const zip = await JSZip.loadAsync(splitRangeMulti.zipBytes);
  const fileNames = Object.keys(zip.files);
  assert(fileNames.length === 2, `ZIP contains 2 files (${fileNames.join(", ")})`);

  // Mode 3: Split Every Page
  const splitEvery = await splitPdfBuffer(docB, { mode: "every" });
  assert(splitEvery.isArchive, "Split every outputs ZIP archive");
  assert(splitEvery.files.length === 3, "3 PDFs created for 3 pages");

  console.log("\n====================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("====================================================\n");

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
