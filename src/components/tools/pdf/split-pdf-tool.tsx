"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Download,
  RotateCcw,
  Split,
  Layers,
  CheckCircle2,
  AlertCircle,
  Archive,
  Scissors,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileDropzone,
  ProcessingIndicator,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  splitPdf,
  SplitMode,
  SplitPdfResult,
  parsePageRanges,
  SPLIT_LIMITS,
} from "@/lib/pdf/split-pdf";
import { getPdfDocumentInfo, PdfDocumentInfo } from "@/lib/pdf/common";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { ObjectUrlManager } from "@/lib/workspace/url";
import { getErrorMessage } from "@/lib/workspace/errors";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";
import { cn } from "@/lib/utils";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: SPLIT_LIMITS.maxFileSizeBytes,
  minSizeBytes: 1,
  acceptedExtensions: [".pdf"],
  acceptedMimeTypes: ["application/pdf"],
  maxFiles: 1,
};

export function SplitPdfTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docInfo, setDocInfo] = useState<PdfDocumentInfo | null>(null);

  // Configuration State
  const [mode, setMode] = useState<SplitMode>("selected");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set([1]));
  const [rangeString, setRangeString] = useState<string>("1-2");
  const [processingStage, setProcessingStage] = useState<string>("Reading PDF...");

  // Results State
  const [result, setResult] = useState<SplitPdfResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Object URL Manager for clean memory lifecycle
  const [urlManager] = useState(() => new ObjectUrlManager());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      urlManager.revokeAll();
    };
  }, [urlManager]);

  // Handle incoming file
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
          "This PDF is password protected or cannot be opened. Please unlock your document before uploading."
        );
      }

      setSelectedFile(file);
      setDocInfo(info);
      // Default to selecting page 1
      setSelectedPages(new Set([1]));
      // Default range example based on document size
      if (info.pageCount > 2) {
        setRangeString(`1-2, ${info.pageCount}`);
      } else {
        setRangeString("1");
      }
      setStatus("idle");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setSelectedFile(null);
      setDocInfo(null);
      setStatus("error");
    }
  };

  // Live validation of page range syntax when in "ranges" mode
  const rangeValidation = useMemo(() => {
    if (!docInfo || mode !== "ranges") return null;
    return parsePageRanges(rangeString, docInfo.pageCount);
  }, [docInfo, mode, rangeString]);

  // Toggle page selection in "selected" mode
  const togglePage = (pageNum: number) => {
    setSelectedPages((prev) => {
      const copy = new Set(prev);
      if (copy.has(pageNum)) {
        copy.delete(pageNum);
      } else {
        copy.add(pageNum);
      }
      return copy;
    });
  };

  const selectAllPages = () => {
    if (!docInfo) return;
    const all = new Set<number>();
    for (let i = 1; i <= docInfo.pageCount; i++) all.add(i);
    setSelectedPages(all);
  };

  const clearPageSelection = () => {
    setSelectedPages(new Set());
  };

  const invertPageSelection = () => {
    if (!docInfo) return;
    setSelectedPages((prev) => {
      const inverted = new Set<number>();
      for (let i = 1; i <= docInfo.pageCount; i++) {
        if (!prev.has(i)) inverted.add(i);
      }
      return inverted;
    });
  };

  // Execute Split
  const handleSplit = async () => {
    if (!selectedFile || !docInfo) return;

    if (mode === "selected" && selectedPages.size === 0) {
      setGeneralError("Please select at least one page to extract.");
      return;
    }

    if (mode === "ranges" && (!rangeValidation || !rangeValidation.isValid)) {
      setGeneralError(rangeValidation?.error || "Please enter a valid page range.");
      return;
    }

    setStatus("processing");
    setGeneralError(null);
    setProcessingStage("Reading PDF...");

    try {
      const res = await splitPdf(
        selectedFile,
        {
          mode,
          selectedPages: Array.from(selectedPages),
          rangeString,
        },
        {
          onProgress: (stage) => setProcessingStage(stage),
        }
      );

      setResult(res);
      setStatus("success");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setStatus("error");
    }
  };

  // Download Output
  const handleDownload = () => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  };

  // Reset Tool
  const handleReset = () => {
    urlManager.revokeAll();
    setSelectedFile(null);
    setDocInfo(null);
    setResult(null);
    setGeneralError(null);
    setSelectedPages(new Set([1]));
    setMode("selected");
    setStatus("idle");
  };

  return (
    <div className="w-full space-y-6">
      {/* Error Alert */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onRetry={selectedFile ? handleSplit : undefined}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* STATE 1: Empty / Idle - Dropzone */}
      {!selectedFile && status !== "processing" && (
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          validationOptions={DROPZONE_VALIDATION}
          title="Drop your PDF here to split"
          subtitle="Supports single PDF documents up to 50MB • Processed 100% locally"
          multiple={false}
          disabled={status === "validating"}
        />
      )}

      {/* STATE 2: Processing Indicator */}
      {status === "processing" && (
        <ProcessingIndicator statusText={processingStage} />
      )}

      {/* STATE 3: Success View with Download */}
      {status === "success" && result && docInfo && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-emerald-50 text-emerald-600 border-emerald-200 shadow-2xs">
                  {result.isArchive ? (
                    <Archive className="h-6 w-6" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    PDF Split Complete!
                  </h3>
                  <p className="text-xs text-slate-500">
                    Generated {result.fileCount} {result.fileCount === 1 ? "document" : "documents"} from {docInfo.filename} in {Math.round(result.executionTimeMs)}ms
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  size="default"
                  onClick={handleDownload}
                  className="gap-2 shadow-sm font-semibold"
                  id="download-split-result-button"
                >
                  <Download className="h-4 w-4" />
                  {result.isArchive ? "Download ZIP Archive" : "Download PDF"}
                </Button>
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleReset}
                  className="gap-2"
                  id="split-another-pdf-button"
                >
                  <RotateCcw className="h-4 w-4" />
                  Split Another
                </Button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Original Document
                </span>
                <p className="text-sm font-bold text-slate-900 truncate" title={docInfo.filename}>
                  {docInfo.filename}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{docInfo.pageCount} total pages</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Output Format
                </span>
                <p className="text-lg sm:text-xl font-bold text-slate-900">
                  {result.isArchive ? `${result.fileCount} PDFs (ZIP)` : "1 Standalone PDF"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Output Size
                </span>
                <p className="text-lg sm:text-xl font-bold text-slate-900">
                  {formatBytes(result.outputSizeBytes)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Generated Package
                </span>
                <p className="text-sm font-bold text-slate-900 truncate" title={result.filename}>
                  {result.filename}
                </p>
              </div>
            </div>

            {/* List of files in archive if applicable */}
            {result.files.length > 1 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
                  Generated Documents inside ZIP ({result.files.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {result.files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        <span className="truncate font-medium text-slate-700">{file.filename}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 shrink-0">
                        {file.pageCount} {file.pageCount === 1 ? "page" : "pages"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy Badge */}
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Your PDF was split 100% locally in your browser sandbox without transmission over the internet.</span>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: Active Configuration State */}
      {selectedFile && docInfo && status !== "success" && status !== "processing" && (
        <div className="space-y-6">
          {/* File Header Card */}
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
              id="choose-different-pdf-button"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Change Document
            </Button>
          </div>

          {/* Split Mode Selector Tabs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Choose Split Mode
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Split mode">
                {/* Mode 1 */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "selected"}
                  onClick={() => setMode("selected")}
                  className={cn(
                    "flex flex-col text-left p-4 rounded-xl border transition-all duration-150",
                    mode === "selected"
                      ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-100 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-sm font-bold text-slate-900">Extract Pages</span>
                    <Scissors className={cn("h-4 w-4", mode === "selected" ? "text-blue-600" : "text-slate-400")} />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Pick specific pages from a visual grid to create 1 single compiled PDF.
                  </p>
                </button>

                {/* Mode 2 */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "ranges"}
                  onClick={() => setMode("ranges")}
                  className={cn(
                    "flex flex-col text-left p-4 rounded-xl border transition-all duration-150",
                    mode === "ranges"
                      ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-100 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-sm font-bold text-slate-900">Page Ranges</span>
                    <Split className={cn("h-4 w-4", mode === "ranges" ? "text-blue-600" : "text-slate-400")} />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Specify custom intervals (e.g. 1-3, 5, 8-10) to generate separate documents.
                  </p>
                </button>

                {/* Mode 3 */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "every"}
                  onClick={() => setMode("every")}
                  className={cn(
                    "flex flex-col text-left p-4 rounded-xl border transition-all duration-150",
                    mode === "every"
                      ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-100 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-sm font-bold text-slate-900">Split Every Page</span>
                    <Layers className={cn("h-4 w-4", mode === "every" ? "text-blue-600" : "text-slate-400")} />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Extract each page into its own individual PDF packaged in a convenient ZIP.
                  </p>
                </button>
              </div>
            </div>

            {/* MODE 1 UI: Interactive Page Grid */}
            {mode === "selected" && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">
                      Select Pages to Extract ({selectedPages.size} of {docInfo.pageCount} selected)
                    </h5>
                    <p className="text-xs text-slate-500">
                      Click pages to include or exclude them from the output PDF.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllPages}
                      className="text-xs h-7 px-2.5"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearPageSelection}
                      className="text-xs h-7 px-2.5"
                    >
                      Clear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={invertPageSelection}
                      className="text-xs h-7 px-2.5"
                    >
                      Invert
                    </Button>
                  </div>
                </div>

                {/* Page Chips Grid */}
                <div
                  className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5 max-h-72 overflow-y-auto p-1 border rounded-xl border-slate-200 bg-slate-50/40"
                  role="group"
                  aria-label="Document pages"
                >
                  {Array.from({ length: docInfo.pageCount }, (_, i) => i + 1).map((page) => {
                    const isSelected = selectedPages.has(page);
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => togglePage(page)}
                        aria-pressed={isSelected}
                        aria-label={`Page ${page}`}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer select-none",
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs scale-[1.02]"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <FileText className={cn("h-5 w-5 mb-1", isSelected ? "text-white" : "text-slate-400")} />
                        <span className="text-xs font-bold">Page {page}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MODE 2 UI: Page Ranges Input */}
            {mode === "ranges" && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="space-y-1.5 max-w-lg">
                  <label
                    htmlFor="split-page-range-input"
                    className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
                  >
                    Custom Page Ranges
                  </label>
                  <input
                    id="split-page-range-input"
                    type="text"
                    value={rangeString}
                    onChange={(e) => setRangeString(e.target.value)}
                    placeholder="e.g. 1-3, 5, 8-10"
                    className={cn(
                      "w-full px-3.5 py-2 text-sm rounded-xl border bg-white text-slate-900 focus:outline-none focus:ring-2",
                      rangeValidation?.isValid
                        ? "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                        : "border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20"
                    )}
                  />
                  <p className="text-[11px] text-slate-500">
                    Separate individual pages or ranges with commas. Example: <span className="font-mono text-slate-700">1-3, 5, 8-10</span>
                  </p>
                </div>

                {/* Validation Status & Preview of Output Groups */}
                {rangeValidation && (
                  <div className="space-y-2.5">
                    {!rangeValidation.isValid ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                        <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                        <span>{rangeValidation.error}</span>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs space-y-2">
                        <div className="flex items-center gap-2 font-semibold text-blue-950">
                          <Info className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>
                            This configuration will generate {rangeValidation.groups.length}{" "}
                            {rangeValidation.groups.length === 1 ? "PDF document" : "separate PDF documents"}:
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {rangeValidation.groups.map((group, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-lg bg-white border border-blue-100 text-slate-700"
                            >
                              <span className="font-bold text-slate-900 block">
                                Document {idx + 1}:
                              </span>
                              <span className="text-slate-600">
                                {group.pageNumbers.length === 1
                                  ? `Page ${group.pageNumbers[0]}`
                                  : `Pages ${group.normalizedRange} (${group.pageNumbers.length} pages)`}
                              </span>
                            </div>
                          ))}
                        </div>
                        {rangeValidation.groups.length > 1 && (
                          <p className="text-[11px] text-blue-800 pt-1">
                            Since multiple documents are generated, they will be bundled together in a ZIP file.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* MODE 3 UI: Split Every Page Notice */}
            {mode === "every" && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 pt-2 border-t border-slate-100">
                <h5 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Split Every Page into Independent Files
                </h5>
                <p className="text-slate-600 leading-relaxed">
                  Every one of the {docInfo.pageCount} pages in <span className="font-semibold text-slate-800">{docInfo.filename}</span> will be extracted as a separate, standalone single-page PDF document. All {docInfo.pageCount} files will be packaged into a single, organized ZIP file for easy one-click download.
                </p>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                {mode === "selected" && (
                  <span>
                    Output: 1 PDF containing {selectedPages.size} {selectedPages.size === 1 ? "page" : "pages"}
                  </span>
                )}
                {mode === "ranges" && rangeValidation?.isValid && (
                  <span>
                    Output: {rangeValidation.groups.length}{" "}
                    {rangeValidation.groups.length === 1 ? "PDF" : "PDFs bundled in a ZIP archive"}
                  </span>
                )}
                {mode === "every" && (
                  <span>Output: {docInfo.pageCount} PDFs bundled in a ZIP archive</span>
                )}
              </div>

              <Button
                size="lg"
                onClick={handleSplit}
                disabled={
                  (mode === "selected" && selectedPages.size === 0) ||
                  (mode === "ranges" && (!rangeValidation || !rangeValidation.isValid))
                }
                className="gap-2 shadow-sm font-semibold text-sm px-6"
                id="split-pdf-submit-button"
              >
                <Split className="h-4 w-4" />
                {mode === "selected"
                  ? `Extract ${selectedPages.size} ${selectedPages.size === 1 ? "Page" : "Pages"}`
                  : mode === "ranges" && rangeValidation?.isValid
                  ? `Split into ${rangeValidation.groups.length} ${rangeValidation.groups.length === 1 ? "PDF" : "PDFs"}`
                  : `Split into ${docInfo.pageCount} PDFs`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
