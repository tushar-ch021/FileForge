"use client";

import React, { useState } from "react";
import {
  FileText,
  Download,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileDropzone,
  ProcessingIndicator,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  convertPdfToWord,
  PdfToWordResult,
} from "@/lib/document/pdf-to-word";
import { getPdfDocumentInfo, PdfDocumentInfo } from "@/lib/pdf/common";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { getErrorMessage } from "@/lib/workspace/errors";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 50 * 1024 * 1024,
  minSizeBytes: 1,
  acceptedExtensions: [".pdf"],
  acceptedMimeTypes: ["application/pdf"],
  maxFiles: 1,
};

export function PdfToWordTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docInfo, setDocInfo] = useState<PdfDocumentInfo | null>(null);
  const [processingStage, setProcessingStage] = useState<string>("Reading PDF...");

  // Results
  const [result, setResult] = useState<PdfToWordResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    setGeneralError(null);
    setResult(null);
    setStatus("validating");

    try {
      const info = await getPdfDocumentInfo(file);
      if (info.isEncrypted) {
        throw new Error(
          "This PDF is password protected. Please unlock it before converting."
        );
      }

      setSelectedFile(file);
      setDocInfo(info);
      setStatus("idle");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setSelectedFile(null);
      setDocInfo(null);
      setStatus("error");
    }
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setStatus("processing");
    setGeneralError(null);
    setProcessingStage("Reading PDF...");

    try {
      const res = await convertPdfToWord(selectedFile, {
        onProgress: (stage) => setProcessingStage(stage),
      });

      setResult(res);
      setStatus("success");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setStatus("error");
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setDocInfo(null);
    setResult(null);
    setGeneralError(null);
    setStatus("idle");
  };

  return (
    <div className="w-full space-y-6">
      {generalError && (
        <ErrorAlert
          message={generalError}
          onRetry={selectedFile ? handleConvert : undefined}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* STATE 1: Empty Dropzone */}
      {!selectedFile && status !== "processing" && (
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          validationOptions={DROPZONE_VALIDATION}
          title="Drop your PDF here to convert to Word (.docx)"
          subtitle="Extracts text, preserves paragraph structure, and generates genuine editable Word document"
          multiple={false}
          disabled={status === "validating"}
        />
      )}

      {/* STATE 2: Processing */}
      {status === "processing" && (
        <ProcessingIndicator statusText={processingStage} />
      )}

      {/* STATE 3: Success View */}
      {status === "success" && result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-emerald-50 text-emerald-600 border-emerald-200 shadow-2xs">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Word Document Generated!
                </h3>
                <p className="text-xs text-slate-500">
                  Extracted and structured {result.paragraphCount} paragraphs across {result.pageCount} pages in {Math.round(result.executionTimeMs)}ms
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                size="default"
                onClick={handleDownload}
                className="gap-2 shadow-sm font-semibold"
                id="download-pdf-word-button"
              >
                <Download className="h-4 w-4" />
                Download Word (.docx)
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={handleReset}
                className="gap-2"
                id="convert-another-pdf-word-button"
              >
                <RotateCcw className="h-4 w-4" />
                Convert Another PDF
              </Button>
            </div>
          </div>

          {/* Scanned warning notice if applicable */}
          {result.scannedPagesCount > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Notice: Scanned / Image-Based Pages Detected</span>
              </div>
              <p className="leading-relaxed text-amber-800">
                {result.scannedPagesCount === result.pageCount
                  ? "All pages appear to be scanned. They were preserved as high-resolution visual images in the Word document because no digital text layer was available."
                  : `${result.scannedPagesCount} of ${result.pageCount} pages appear to be scanned and were preserved as images. Remaining pages were reconstructed into editable text and tables.`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center sm:text-left">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Pages
              </span>
              <p className="text-lg font-bold text-slate-900">
                {result.pageCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center sm:text-left">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Paragraphs
              </span>
              <p className="text-lg font-bold text-slate-900">
                {result.paragraphCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center sm:text-left">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Tables Built
              </span>
              <p className="text-lg font-bold text-slate-900">
                {result.tableCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center sm:text-left">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Headings
              </span>
              <p className="text-lg font-bold text-slate-900">
                {result.headingCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center sm:text-left col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Output Size
              </span>
              <p className="text-lg font-bold text-slate-900">
                {formatBytes(result.docxSizeBytes)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Extracted and compiled directly in your browser. Fully editable in Microsoft Word and LibreOffice.</span>
          </div>
        </div>
      )}

      {/* STATE 4: Workspace / Ready */}
      {selectedFile && docInfo && status !== "success" && status !== "processing" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate" title={docInfo.filename}>
                  {docInfo.filename}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">
                    {docInfo.pageCount} {docInfo.pageCount === 1 ? "page" : "pages"}
                  </span>
                  <span>•</span>
                  <span>{formatBytes(docInfo.sizeBytes)}</span>
                  <span>•</span>
                  <span className="text-slate-400">{docInfo.pdfVersion}</span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-xs text-slate-600 hover:text-rose-600"
              id="change-pdf-to-word-file-button"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Change Document
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 text-slate-600">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Conversion Pipeline & Layout Information</span>
              </div>
              <p className="leading-relaxed">
                The converter performs deep coordinate-based font and text extraction, reorganizing lines into coherent paragraphs and heading levels. The resulting file is a standard OpenXML <strong>.docx</strong> document ready for direct editing.
              </p>
              <p className="text-[11px] text-slate-500">
                Note: Complex multi-column magazine grids or scanned image PDFs may require manual adjustment in Microsoft Word.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                100% In-Browser • Generates editable OpenXML Word Document
              </p>
              <Button
                size="lg"
                onClick={handleConvert}
                className="gap-2 shadow-sm font-semibold text-sm px-6"
                id="convert-pdf-to-word-submit-button"
              >
                <FileCode className="h-4 w-4" />
                Convert PDF to Word (.docx)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
