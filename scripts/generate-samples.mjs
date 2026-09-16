import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

async function makePdf(filePath, pages, title) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`${title} - Page ${i} of ${pages}`, {
      x: 50,
      y: 700,
      size: 24,
      font,
      color: rgb(0.1, 0.3, 0.7),
    });
    page.drawText("This is verified client-side generated text.", {
      x: 50,
      y: 650,
      size: 14,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  const bytes = await doc.save();
  fs.writeFileSync(filePath, bytes);
}

async function main() {
  const testDir = path.resolve("test-docs");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
  await makePdf(path.join(testDir, "document-a.pdf"), 2, "Invoice A");
  await makePdf(path.join(testDir, "document-b.pdf"), 3, "Report B");
  await makePdf(path.join(testDir, "document-c.pdf"), 4, "Manual C");
  console.log("Created test PDFs in test-docs/");
}

main().catch(console.error);
