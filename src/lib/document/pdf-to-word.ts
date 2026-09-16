import type { ISectionOptions } from "docx";
import { isValidPdfSignature, isPdfPasswordProtected } from "../pdf/common";

export interface PdfToWordResult {
  blob: Blob;
  filename: string;
  pageCount: number;
  originalSizeBytes: number;
  docxSizeBytes: number;
  executionTimeMs: number;
  paragraphCount: number;
  tableCount: number;
  headingCount: number;
  scannedPagesCount: number;
  scannedPages: number[];
  warnings: string[];
}

export interface PdfToWordOptions {
  onProgress?: (stage: string) => void;
}

interface ExtractedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
}

interface ExtractedLine {
  y: number;
  minX: number;
  maxX: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  items: ExtractedTextItem[];
  fullText: string;
}

/**
 * Loads the local PDF.js worker without CDN dependency.
 */
async function getPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjs;
}

/**
 * Converts PDF points (1/72 inch) to Word twips (1/1440 inch).
 * 1 point = 20 twips.
 */
function ptToTwips(pt: number): number {
  return Math.round(pt * 20);
}

/**
 * Converts a browser Canvas to a Uint8Array byte buffer.
 */
async function canvasToBytes(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        try {
          const ab = await blob.arrayBuffer();
          resolve(new Uint8Array(ab));
        } catch {
          resolve(null);
        }
      },
      "image/jpeg",
      0.9
    );
  });
}

/**
 * Extracts structured text, layout, tables, geometry, and visual elements
 * to compile a high-fidelity Microsoft Word (.docx) document.
 */
export async function convertPdfToWord(
  file: File,
  options: PdfToWordOptions = {}
): Promise<PdfToWordResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  if (!file || file.size === 0) {
    throw new Error("Please upload a valid, non-empty PDF file.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (!isValidPdfSignature(bytes)) {
    throw new Error("Invalid PDF document: Missing standard %PDF- file signature.");
  }

  options.onProgress?.("Reading PDF...");

  const pdfjs = await getPdfJs();

  let pdfDoc;
  try {
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      isEvalSupported: false,
    });
    pdfDoc = await loadingTask.promise;
  } catch (err: unknown) {
    if (isPdfPasswordProtected(err)) {
      throw new Error("This PDF is password protected. Please unlock it before converting.");
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Unable to parse PDF: ${msg}`);
  }

  const numPages = pdfDoc.numPages;
  if (numPages === 0) {
    throw new Error("The uploaded PDF document contains 0 pages.");
  }

  options.onProgress?.("Analyzing layout & typography...");

  const docxModule = await import("docx");
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
    PageOrientation,
    ImageRun,
    ShadingType,
  } = docxModule;

  // Track overall document metrics
  let totalParagraphCount = 0;
  let totalTableCount = 0;
  let totalHeadingCount = 0;
  const scannedPages: number[] = [];
  const sections: ISectionOptions[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    options.onProgress?.(`Processing page ${pageNum} of ${numPages}...`);

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    const pageWidthPt = viewport.width;
    const pageHeightPt = viewport.height;
    const isLandscape = pageWidthPt > pageHeightPt;

    const textContent = await page.getTextContent();
    const items: ExtractedTextItem[] = [];
    let pageCharCount = 0;

    for (const rawItem of textContent.items) {
      if ("str" in rawItem && rawItem.str.trim()) {
        const transform = rawItem.transform;
        const x = Math.round(transform[4] * 10) / 10;
        const y = Math.round(transform[5] * 10) / 10;
        const fontSize = Math.round(Math.abs(transform[0]) * 10) / 10 || 11;
        const fontName = (rawItem.fontName || "").toLowerCase();

        const isBold = /bold|black|heavy|b\d{0,2}$/i.test(fontName);
        const isItalic = /italic|oblique/i.test(fontName);

        items.push({
          str: rawItem.str,
          x,
          y,
          width: rawItem.width || 0,
          height: rawItem.height || fontSize,
          fontSize,
          fontName,
          isBold,
          isItalic,
        });

        pageCharCount += rawItem.str.length;
      }
    }

    // SECTION BUILDER FOR THIS PAGE
    const pageChildren: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

    // CASE 1: SCANNED / IMAGE-ONLY PAGE (< 15 characters)
    if (pageCharCount < 15) {
      scannedPages.push(pageNum);

      let imageBytes: Uint8Array | null = null;
      if (typeof document !== "undefined") {
        try {
          const renderScale = 1.5; // ~108 DPI for crisp text clarity
          const renderViewport = page.getViewport({ scale: renderScale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(renderViewport.width);
          canvas.height = Math.floor(renderViewport.height);

          const ctx = canvas.getContext("2d", { alpha: false });
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
            imageBytes = await canvasToBytes(canvas);
          }
        } catch {
          // Fallback if canvas render fails
        }
      }

      if (imageBytes && imageBytes.length > 0) {
        pageChildren.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageBytes as unknown as Uint8Array,
                transformation: {
                  width: Math.min(580, Math.round(pageWidthPt * 0.95)),
                  height: Math.min(780, Math.round(pageHeightPt * 0.95)),
                },
                type: "jpg",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
          })
        );
      } else {
        // Safe readable placeholder if rendering canvas is unavailable
        pageChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[Page ${pageNum}: Scanned Content]`,
                italics: true,
                color: "64748B",
                size: 22,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          })
        );
      }

      sections.push({
        properties: {
          page: {
            size: {
              width: ptToTwips(pageWidthPt),
              height: ptToTwips(pageHeightPt),
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: ptToTwips(36), // 0.5 inch margins for image pages
              bottom: ptToTwips(36),
              left: ptToTwips(36),
              right: ptToTwips(36),
            },
          },
        },
        children: pageChildren,
      });

      page.cleanup();
      continue;
    }

    // CASE 2: TEXT-BASED PAGE
    // Compute content bounding box to estimate margins
    let minX = pageWidthPt;
    let maxX = 0;
    let minY = pageHeightPt;
    let maxY = 0;
    const fontSizes: number[] = [];

    for (const it of items) {
      if (it.x < minX) minX = it.x;
      if (it.x + it.width > maxX) maxX = it.x + it.width;
      if (it.y < minY) minY = it.y;
      if (it.y + it.height > maxY) maxY = it.y + it.height;
      fontSizes.push(it.fontSize);
    }

    // Compute median font size for relative heading classification
    fontSizes.sort((a, b) => a - b);
    const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 11;

    // Estimate page margins (bounded between 0.35in and 1.0in)
    const estMarginLeftTwips = Math.max(ptToTwips(25), Math.min(ptToTwips(72), ptToTwips(minX)));
    const estMarginRightTwips = Math.max(ptToTwips(25), Math.min(ptToTwips(72), ptToTwips(pageWidthPt - maxX)));
    const estMarginTopTwips = Math.max(ptToTwips(36), Math.min(ptToTwips(72), ptToTwips(pageHeightPt - maxY)));
    const estMarginBottomTwips = Math.max(ptToTwips(36), Math.min(ptToTwips(72), ptToTwips(minY)));

    // COLUMN DETECTION & READING ORDER:
    // Check if the page has a vertical gutter splitting it into 2 distinct columns
    let columnGroups: ExtractedTextItem[][] = [items];
    const midPageX = pageWidthPt / 2;
    const leftColItems = items.filter((it) => it.x + it.width <= midPageX + 15);
    const rightColItems = items.filter((it) => it.x >= midPageX - 15);

    // If both left and right columns have at least 25% of the items and clear gutter exists
    if (
      leftColItems.length >= items.length * 0.25 &&
      rightColItems.length >= items.length * 0.25 &&
      leftColItems.length + rightColItems.length >= items.length * 0.85
    ) {
      columnGroups = [leftColItems, rightColItems];
    }

    for (const colItems of columnGroups) {
      // Sort column items top-to-bottom (y descending), then left-to-right (x ascending)
      colItems.sort((a, b) => {
        const yDelta = Math.abs(a.y - b.y);
        if (yDelta < 3.5) {
          return a.x - b.x;
        }
        return b.y - a.y;
      });

      // Group items into visual lines
      const lines: ExtractedLine[] = [];
      let curLine: ExtractedLine | null = null;

      for (const item of colItems) {
        if (!curLine) {
          curLine = {
            y: item.y,
            minX: item.x,
            maxX: item.x + item.width,
            fontSize: item.fontSize,
            isBold: item.isBold,
            isItalic: item.isItalic,
            items: [item],
            fullText: item.str,
          };
        } else {
          const yDiff = Math.abs(curLine.y - item.y);
          if (yDiff < 4.0) {
            curLine.items.push(item);
            curLine.minX = Math.min(curLine.minX, item.x);
            curLine.maxX = Math.max(curLine.maxX, item.x + item.width);
            curLine.fontSize = Math.max(curLine.fontSize, item.fontSize);
            curLine.isBold = curLine.isBold || item.isBold;
            curLine.isItalic = curLine.isItalic || item.isItalic;

            const prevItem = curLine.items[curLine.items.length - 2];
            const gap = item.x - (prevItem.x + prevItem.width);
            const needsSpace = gap > 1.5 && !prevItem.str.endsWith(" ") && !item.str.startsWith(" ");
            curLine.fullText += (needsSpace ? " " : "") + item.str;
          } else {
            lines.push(curLine);
            curLine = {
              y: item.y,
              minX: item.x,
              maxX: item.x + item.width,
              fontSize: item.fontSize,
              isBold: item.isBold,
              isItalic: item.isItalic,
              items: [item],
              fullText: item.str,
            };
          }
        }
      }
      if (curLine) lines.push(curLine);

      // TABLE DETECTION ACROSS LINES:
      // Group lines into tables or regular paragraphs
      let lineIdx = 0;
      while (lineIdx < lines.length) {
        // Lookahead to check if lines form a table candidate (2+ consecutive lines with 2+ columns)
        let tableLineEnd = lineIdx;
        while (tableLineEnd < lines.length && lines[tableLineEnd].items.length >= 2) {
          tableLineEnd++;
        }

        const candidateCount = tableLineEnd - lineIdx;
        if (candidateCount >= 2) {
          // Build real DOCX Table
          const tableLines = lines.slice(lineIdx, tableLineEnd);

          // Find column boundaries
          const colXCoords: number[] = [];
          for (const tl of tableLines) {
            for (const it of tl.items) {
              colXCoords.push(it.x);
            }
          }
          colXCoords.sort((a, b) => a - b);

          const colCenters: number[] = [];
          for (const x of colXCoords) {
            const match = colCenters.find((c) => Math.abs(c - x) <= 18);
            if (match === undefined) colCenters.push(x);
          }
          colCenters.sort((a, b) => a - b);

          if (colCenters.length >= 2) {
            const tableRows: InstanceType<typeof TableRow>[] = [];

            for (let r = 0; r < tableLines.length; r++) {
              const tl = tableLines[r];
              const isHeader = r === 0;
              const cellTexts: string[] = new Array(colCenters.length).fill("");

              for (const it of tl.items) {
                let bestCol = 0;
                let minDist = Number.POSITIVE_INFINITY;
                for (let c = 0; c < colCenters.length; c++) {
                  const dist = Math.abs(colCenters[c] - it.x);
                  if (dist < minDist) {
                    minDist = dist;
                    bestCol = c;
                  }
                }
                cellTexts[bestCol] = cellTexts[bestCol]
                  ? `${cellTexts[bestCol]} ${it.str}`.trim()
                  : it.str;
              }

              tableRows.push(
                new TableRow({
                  tableHeader: isHeader,
                  children: cellTexts.map((text) =>
                    new TableCell({
                      shading: isHeader ? { fill: "F1F5F9", type: ShadingType.CLEAR } : undefined,
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                      },
                      margins: {
                        top: ptToTwips(4),
                        bottom: ptToTwips(4),
                        left: ptToTwips(8),
                        right: ptToTwips(8),
                      },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: text || " ",
                              bold: isHeader || tl.isBold,
                              size: Math.round(tl.fontSize * 2),
                            }),
                          ],
                          spacing: { before: 0, after: 0 },
                        }),
                      ],
                    })
                  ),
                })
              );
            }

            pageChildren.push(
              new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );

            totalTableCount++;
            lineIdx = tableLineEnd;
            continue;
          }
        }

        // REGULAR PARAGRAPH / HEADING LINE
        const line = lines[lineIdx];
        const text = line.fullText.trim();

        if (text) {
          // Alignment detection
          let alignment: typeof AlignmentType.LEFT | typeof AlignmentType.CENTER | typeof AlignmentType.RIGHT = AlignmentType.LEFT;
          const lineCenter = (line.minX + line.maxX) / 2;
          const isCentered = Math.abs(lineCenter - midPageX) < 25 && line.maxX - line.minX < pageWidthPt - 120;
          const isRightAligned = line.minX > midPageX && Math.abs(line.maxX - (pageWidthPt - 50)) < 35;

          if (isCentered) {
            alignment = AlignmentType.CENTER;
          } else if (isRightAligned) {
            alignment = AlignmentType.RIGHT;
          }

          // Heading classification
          const isH1 = line.fontSize >= medianFontSize * 1.6 || line.fontSize >= 18;
          const isH2 = !isH1 && (line.fontSize >= medianFontSize * 1.3 || line.fontSize >= 14);
          const isH3 = !isH1 && !isH2 && (line.fontSize >= medianFontSize * 1.15 && line.isBold);

          if (isH1 || isH2 || isH3) {
            totalHeadingCount++;
            const headingLvl = isH1 ? HeadingLevel.HEADING_1 : isH2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;

            pageChildren.push(
              new Paragraph({
                text,
                heading: headingLvl,
                alignment,
                spacing: { before: 240, after: 120 },
              })
            );
          } else {
            // Standard formatted paragraph with preserved text runs
            const runs: InstanceType<typeof TextRun>[] = [];
            for (let rIdx = 0; rIdx < line.items.length; rIdx++) {
              const item = line.items[rIdx];
              const prev = line.items[rIdx - 1];
              const leadingSpace = prev && item.x - (prev.x + prev.width) > 1.5 ? " " : "";

              runs.push(
                new TextRun({
                  text: leadingSpace + item.str,
                  bold: item.isBold,
                  italics: item.isItalic,
                  size: Math.round(item.fontSize * 2),
                })
              );
            }

            pageChildren.push(
              new Paragraph({
                children: runs.length > 0 ? runs : [new TextRun(text)],
                alignment,
                spacing: { before: 40, after: 80, line: 276 },
              })
            );
          }

          totalParagraphCount++;
        }

        lineIdx++;
      }
    }

    // Assemble section for this page preserving geometry and margins
    sections.push({
      properties: {
        page: {
          size: {
            width: ptToTwips(pageWidthPt),
            height: ptToTwips(pageHeightPt),
            orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
          },
          margin: {
            top: estMarginTopTwips,
            bottom: estMarginBottomTwips,
            left: estMarginLeftTwips,
            right: estMarginRightTwips,
          },
        },
      },
      children: pageChildren.length > 0 ? pageChildren : [new Paragraph({ text: "" })],
    });

    page.cleanup();
  }

  // Diagnostic notifications (strictly for UI metrics, zero document-body pollution)
  if (scannedPages.length > 0) {
    if (scannedPages.length === numPages) {
      warnings.push(
        "All pages appear to be scanned/image-based. Pages were preserved as high-resolution images in the Word document. Text is not directly editable without OCR."
      );
    } else {
      warnings.push(
        `${scannedPages.length} of ${numPages} pages were scanned and preserved as visual images. Remaining pages were converted to editable text.`
      );
    }
  }

  options.onProgress?.("Compiling Word document (.docx)...");

  const wordDocument = new Document({
    sections,
  });

  options.onProgress?.("Generating DOCX package...");

  const docxBlob = await Packer.toBlob(wordDocument);

  options.onProgress?.("Validating DOCX package...");

  // Verify DOCX is a valid OpenXML ZIP containing word/document.xml
  try {
    const jszipModule = await import("jszip");
    const JSZip = jszipModule.default || jszipModule;
    const testZip = await JSZip.loadAsync(await docxBlob.arrayBuffer());
    if (!testZip.file("word/document.xml") || !testZip.file("[Content_Types].xml")) {
      throw new Error("Validation failed: Generated document missing standard OpenXML parts.");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`DOCX verification failed: ${msg}`);
  }

  options.onProgress?.("Complete");

  const baseName = file.name.replace(/\.pdf$/i, "");
  const filename = `${baseName}.docx`;
  const executionTimeMs = Math.round(performance.now() - startTime);

  return {
    blob: docxBlob,
    filename,
    pageCount: numPages,
    originalSizeBytes: file.size,
    docxSizeBytes: docxBlob.size,
    executionTimeMs,
    paragraphCount: totalParagraphCount,
    tableCount: totalTableCount,
    headingCount: totalHeadingCount,
    scannedPagesCount: scannedPages.length,
    scannedPages,
    warnings,
  };
}
