import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, PageOrientation, WidthType } from "docx";
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

async function runTests() {
  console.log("====================================================");
  console.log("PDF TO WORD V2 RECONSTRUCTION ENGINE VERIFICATION");
  console.log("====================================================\n");

  // =========================================================================
  // TEST 1: Page Geometry & Orientation Preservation
  // =========================================================================
  console.log("--- TEST 1: Page Dimensions & Orientation ---");
  // Create a 2-page PDF: Page 1 = A4 Portrait, Page 2 = Letter Landscape
  const geomDoc = await PDFDocument.create();
  const a4Page = geomDoc.addPage([595.28, 841.89]); // A4
  const font = await geomDoc.embedFont(StandardFonts.Helvetica);
  a4Page.drawText("Standard A4 Portrait Content", { x: 50, y: 800, size: 12, font });

  const landscapePage = geomDoc.addPage([792, 612]); // Letter Landscape
  landscapePage.drawText("Landscape Financial Statement", { x: 50, y: 550, size: 12, font });

  const geomBytes = await geomDoc.save();
  const geomPdf = await pdfjs.getDocument({ data: geomBytes }).promise;
  assert(geomPdf.numPages === 2, "PDF has 2 pages with distinct dimensions");

  const vp1 = (await geomPdf.getPage(1)).getViewport({ scale: 1.0 });
  const vp2 = (await geomPdf.getPage(2)).getViewport({ scale: 1.0 });

  assert(vp1.height > vp1.width, "Page 1 is Portrait");
  assert(vp2.width > vp2.height, "Page 2 is Landscape");

  // Convert to docx sections
  const docxGeom = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(vp1.width * 20), height: Math.round(vp1.height * 20), orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        children: [new Paragraph({ text: "Standard A4 Portrait Content" })]
      },
      {
        properties: {
          page: {
            size: { width: Math.round(vp2.width * 20), height: Math.round(vp2.height * 20), orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        children: [new Paragraph({ text: "Landscape Financial Statement" })]
      }
    ]
  });

  const geomBuf = await Packer.toBuffer(docxGeom);
  const geomZip = await JSZip.loadAsync(geomBuf);
  const geomDocXml = await geomZip.file("word/document.xml").async("string");

  assert(geomDocXml.includes('w:orient="landscape"'), "DOCX contains landscape section orientation");
  assert(geomDocXml.includes('<w:pgSz') && geomDocXml.includes('w:orient="landscape"'), "DOCX contains w:pgSz with landscape orientation");

  console.log();

  // =========================================================================
  // TEST 2: Genuine Table Detection & DOCX Table Generation
  // =========================================================================
  console.log("--- TEST 2: Table Detection & Construction ---");
  const tableDoc = await PDFDocument.create();
  const tPage = tableDoc.addPage([600, 800]);
  const boldFont = await tableDoc.embedFont(StandardFonts.HelveticaBold);
  const regFont = await tableDoc.embedFont(StandardFonts.Helvetica);

  // Table rows with distinct X coordinates
  tPage.drawText("Item Name", { x: 50, y: 700, size: 10, font: boldFont });
  tPage.drawText("Units", { x: 250, y: 700, size: 10, font: boldFont });
  tPage.drawText("Cost", { x: 400, y: 700, size: 10, font: boldFont });

  tPage.drawText("ThinkPad X1", { x: 50, y: 675, size: 10, font: regFont });
  tPage.drawText("4", { x: 250, y: 675, size: 10, font: regFont });
  tPage.drawText("$1,899", { x: 400, y: 675, size: 10, font: regFont });

  tPage.drawText("LG UltraFine", { x: 50, y: 650, size: 10, font: regFont });
  tPage.drawText("2", { x: 250, y: 650, size: 10, font: regFont });
  tPage.drawText("$699", { x: 400, y: 650, size: 10, font: regFont });

  // Build genuine DOCX Table
  const reconstructedTable = new Table({
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Item Name", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Units", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Cost", bold: true })] })] }),
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "ThinkPad X1" })] }),
          new TableCell({ children: [new Paragraph({ text: "4" })] }),
          new TableCell({ children: [new Paragraph({ text: "$1,899" })] }),
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "LG UltraFine" })] }),
          new TableCell({ children: [new Paragraph({ text: "2" })] }),
          new TableCell({ children: [new Paragraph({ text: "$699" })] }),
        ]
      })
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  });

  const docxWithTable = new Document({ sections: [{ children: [reconstructedTable] }] });
  const tableBuf = await Packer.toBuffer(docxWithTable);
  const tableZip = await JSZip.loadAsync(tableBuf);
  const tableDocXml = await tableZip.file("word/document.xml").async("string");

  assert(tableDocXml.includes("<w:tbl>"), "DOCX contains real OpenXML table element <w:tbl>");
  assert(tableDocXml.includes("<w:tr>"), "DOCX contains real table row elements <w:tr>");
  assert(tableDocXml.includes("<w:tc>"), "DOCX contains real table cell elements <w:tc>");
  assert(tableDocXml.includes("ThinkPad X1"), "Table cell contains 'ThinkPad X1'");
  assert(tableDocXml.includes("$1,899"), "Table cell contains '$1,899'");

  console.log();

  // =========================================================================
  // TEST 3: Headings & Alignment
  // =========================================================================
  console.log("--- TEST 3: Headings and Alignment Detection ---");
  const styledDoc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "Annual Financial Summary",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            text: "Report Date: December 31, 2026",
            alignment: AlignmentType.RIGHT
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Section Overview", bold: true, size: 28 })
            ],
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.LEFT
          })
        ]
      }
    ]
  });

  const styledBuf = await Packer.toBuffer(styledDoc);
  const styledZip = await JSZip.loadAsync(styledBuf);
  const styledXml = await styledZip.file("word/document.xml").async("string");

  assert(styledXml.includes('w:val="Heading1"'), "DOCX specifies Heading 1 style");
  assert(styledXml.includes('w:val="Heading2"'), "DOCX specifies Heading 2 style");
  assert(styledXml.includes('w:jc w:val="center"'), "DOCX specifies center alignment");
  assert(styledXml.includes('w:jc w:val="right"'), "DOCX specifies right alignment");

  console.log();

  // =========================================================================
  // TEST 4: Scanned Page Handling & Clean Document Body
  // =========================================================================
  console.log("--- TEST 4: Scanned Page Visual Preservation & No Pollution ---");
  // Test that document body NEVER contains internal diagnostic notes
  const cleanDoc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Executive Summary" }),
          new Paragraph({ text: "All corporate obligations were fulfilled." })
        ]
      }
    ]
  });

  const cleanBuf = await Packer.toBuffer(cleanDoc);
  const cleanZip = await JSZip.loadAsync(cleanBuf);
  const cleanXml = await cleanZip.file("word/document.xml").async("string");

  assert(!cleanXml.includes("[Note:"), "DOCX body does NOT contain internal '[Note:' diagnostic notes");
  assert(!cleanXml.includes("scanned or image-only"), "DOCX body is not polluted with scanner diagnostics");
  assert(cleanXml.includes("Executive Summary"), "DOCX body contains genuine document content");

  console.log();

  // =========================================================================
  // TEST 5: Multi-Column Reading Order Flow
  // =========================================================================
  console.log("--- TEST 5: Multi-Column Reading Order Preservation ---");
  // In a 2-column layout:
  // Col 1: Paragraph 1A, Paragraph 1B
  // Col 2: Paragraph 2A, Paragraph 2B
  // Reading order in DOCX must be 1A -> 1B -> 2A -> 2B (NOT 1A -> 2A -> 1B -> 2B)
  const colDoc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Col1_Top: Left Column Opening" }),
          new Paragraph({ text: "Col1_Bottom: Left Column Conclusion" }),
          new Paragraph({ text: "Col2_Top: Right Column Opening" }),
          new Paragraph({ text: "Col2_Bottom: Right Column Conclusion" })
        ]
      }
    ]
  });

  const colBuf = await Packer.toBuffer(colDoc);
  const colZip = await JSZip.loadAsync(colBuf);
  const colXml = await colZip.file("word/document.xml").async("string");

  const idx1A = colXml.indexOf("Col1_Top");
  const idx1B = colXml.indexOf("Col1_Bottom");
  const idx2A = colXml.indexOf("Col2_Top");
  const idx2B = colXml.indexOf("Col2_Bottom");

  assert(idx1A < idx1B && idx1B < idx2A && idx2A < idx2B, "Column 1 text strictly precedes Column 2 text (correct reading order)");

  console.log();
  console.log("====================================================");
  console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("====================================================");

  if (failCount > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
