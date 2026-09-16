# FileForge 🛠️

> **Fast, Private, In-Browser File & Developer Tools**  
> 100% Client-Side Processing • Zero Server Uploads • Free Forever

FileForge is a production-grade web application offering 26 specialized utilities across PDF editing, image conversion, and developer workflows. All operations run directly in your browser's local sandbox using WebAssembly, Web Crypto, and the HTML5 Canvas API. Your files never leave your device.

---

## ✨ Features & Included Tools

### 📄 PDF Tools (9 Tools)
- **PDF Compressor**: Optimize PDF file size with real stream compression and image downsampling.
- **PDF Merger**: Combine multiple PDF files into a single unified document with custom reordering.
- **PDF Splitter**: Extract specific page ranges or burst all pages into individual files.
- **PDF to Word (DOCX)**: High-fidelity document reconstruction preserving multi-column layouts, tables, typography, and scanned pages.
- **Word to PDF**: Convert DOCX documents into clean PDF files client-side.
- **PDF to Excel (XLSX)**: Detect tabular structures and extract data into structured spreadsheets.
- **PDF Password / Unlock**: Decrypt password-protected PDFs locally.
- **PDF to JPG**: Render high-res image previews for each page and download individually or as a ZIP.
- **JPG to PDF**: Package multiple images into an organized, print-ready PDF.

### 🖼️ Image Tools (7 Tools)
- **Image Compressor**: Fine-tuned WebP/JPEG compression with visual side-by-side quality controls.
- **Image Converter**: Convert between PNG, JPEG, WebP, AVIF, and BMP formats instantly.
- **Image Resizer**: Dimension scaling by exact pixel dimensions or percentage with aspect ratio lock.
- **Image Cropper**: Interactive aspect ratio cropping with grid overlays.
- **Remove Background**: In-browser AI background removal powered by ONNX runtime.
- **Image Metadata Cleaner**: Strip privacy-compromising EXIF, GPS, and camera metadata tags.
- **Image to PDF**: Convert collections of images into standardized PDF documents.

### 💻 Developer Tools (10 Tools)
- **JSON Formatter**: Pretty-print, compact, sort keys, and validate JSON data.
- **JSON Validator**: Syntax error locator and schema validation.
- **JWT Decoder**: Inspect header, payload claims, signature status, and token expiration.
- **Base64 Encoder / Decoder**: Safe UTF-8 Base64 conversion for strings and binary files.
- **URL Encoder / Decoder**: Standard URL percent-encoding and decoding with component mode.
- **UUID Generator**: Bulk v4 UUID creation with customizable formatting.
- **RegEx Tester**: Real-time regular expression matching with flag controls and match details.
- **Timestamp Converter**: Convert between Unix epoch timestamps and human-readable dates.
- **Color Converter**: Seamless conversion across HEX, RGB, HSL, and HSV color models.
- **Hash Generator**: Cryptographic hash calculation (SHA-256, SHA-512, SHA-1, MD5) using Web Crypto.

---

## 🔒 Privacy & Architecture

FileForge adheres to a strict 3-tier client-side architecture:
1. **Page & SEO Layer**: Next.js App Router with Server-Side Rendering, OpenGraph tags, and Schema.org JSON-LD structured data.
2. **Interactive Tool Workspace**: Uniform reactive shells providing drag-and-drop file upload, progress indicators, error alerts, and download management.
3. **Pure Processing Layer**: Local WebAssembly and JavaScript engines (`pdf-lib`, `pdfjs-dist`, `docx`, `write-excel-file`, `@pdfsmaller/pdf-decrypt`) executing isolated in the user's browser.

**No tracking. No permanent storage. Zero server uploads.**

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm, pnpm, or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/tushar-ch021/FileForge.git

# Enter project directory
cd FileForge

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 🧪 Testing & Verification

FileForge includes automated test suites covering all conversion engines and workspace utilities:

```bash
# Run ESLint
npm run lint

# Build for production
npm run build
```

---

## 📄 License

MIT License. Free to use for personal and commercial workflows.
