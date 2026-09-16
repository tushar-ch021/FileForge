"use client";

import React, { useState } from "react";
import {
  FileText,
  Download,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Info,
  FileType,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileDropzone,
  ProcessingIndicator,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  convertWordToPdf,
  isValidDocxFile,
  WordToPdfResult,
  WordPdfPageSize,
  WordPdfOrientation,
  WordPdfMargin,
} from "@/lib/document/word-to-pdf";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { getErrorMessage } from "@/lib/workspace/errors";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 50 * 1024 * 1024,
  minSizeBytes: 1,
  acceptedExtensions: [".docx"],
  maxFiles: 1,
};

export function WordToPdfTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Settings
  const [pageSize, setPageSize] = useState<WordPdfPageSize>("a4");
  const [orientation, setOrientation] = useState<WordPdfOrientation>("portrait");
  const [margin, setMargin] = useState<WordPdfMargin>("normal");
  const [processingStage, setProcessingStage] = useState<string>("Reading DOCX...");

  // Results
  const [result, setResult] = useState<WordToPdfResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    setGeneralError(null);
    setResult(null);
    setStatus("validating");

    const validCheck = await isValidDocxFile(file);
    if (!validCheck.isValid) {
      setGeneralError(validCheck.error || "Please select a valid .docx file.");
      setStatus("error");
      return;
    }

    setSelectedFile(file);
    setStatus("idle");
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setStatus("processing");
    setGeneralError(null);
    setProcessingStage("Reading DOCX...");

    try {
      const res = await convertWordToPdf(selectedFile, {
        pageSize,
        orientation,
        margin,
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
          title="Drop your Word (.docx) document here to convert to PDF"
          subtitle="Converts text, headings, tables, and formatting into clean PDF • 100% Client-Side"
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
                  PDF Generated Successfully!
                </h3>
                <p className="text-xs text-slate-500">
                  Compiled {result.pageCount} {result.pageCount === 1 ? "page" : "pages"} with searchable text in {Math.round(result.executionTimeMs)}ms
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                size="default"
                onClick={handleDownload}
                className="gap-2 shadow-sm font-semibold"
                id="download-word-pdf-button"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={handleReset}
                className="gap-2"
                id="convert-another-word-pdf-button"
              >
                <RotateCcw className="h-4 w-4" />
                Convert Another DOCX
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Pages Created
              </span>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {result.pageCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Paragraphs Parsed
              </span>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {result.paragraphCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                PDF File Size
              </span>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {formatBytes(result.outputSizeBytes)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Filename
              </span>
              <p className="text-sm font-bold text-slate-900 truncate" title={result.filename}>
                {result.filename}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Word document parsed and converted strictly in your browser. No files transmitted to external servers.</span>
          </div>
        </div>
      )}

      {/* STATE 4: Workspace / Settings */}
      {selectedFile && status !== "success" && status !== "processing" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                <FileType className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatBytes(selectedFile.size)} • Microsoft Word Document (.docx)
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-xs text-slate-600 hover:text-rose-600"
              id="change-word-file-button"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Change Document
            </Button>
          </div>

          {/* Layout Settings */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              <Sliders className="h-4 w-4 text-blue-600" />
              <span>Target PDF Page Setup</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Page Size
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as WordPdfPageSize)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="letter">US Letter (8.5 × 11 in)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Orientation
                </label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as WordPdfOrientation)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Margins
                </label>
                <select
                  value={margin}
                  onChange={(e) => setMargin(e.target.value as WordPdfMargin)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="normal">Normal (20 mm)</option>
                  <option value="narrow">Narrow (10 mm)</option>
                  <option value="wide">Wide (30 mm)</option>
                </select>
              </div>
            </div>

            {/* Features & Limitations info banner */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-600">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Supported Content & Layout Behavior</span>
              </div>
              <p className="leading-relaxed">
                <strong>Supported:</strong> Text paragraphs, headings (H1–H3), bold/italic typography, bulleted & numbered lists, tables, and auto-pagination with selectable vector text.
              </p>
              <p className="text-[11px] text-slate-500">
                Note: Highly specialized desktop publisher elements (e.g. WordArt, dynamic macros, tracked revisions) are cleanly simplified into standard text blocks.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                Generates vector PDF with selectable text
              </p>
              <Button
                size="lg"
                onClick={handleConvert}
                className="gap-2 shadow-sm font-semibold text-sm px-6"
                id="convert-word-to-pdf-submit-button"
              >
                <FileText className="h-4 w-4" />
                Convert DOCX to PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
