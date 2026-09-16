"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Download,
  RotateCcw,
  Table,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileDropzone,
  ProcessingIndicator,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  convertPdfToExcel,
  PdfToExcelResult,
} from "@/lib/pdf/pdf-to-excel";
import { getPdfDocumentInfo, PdfDocumentInfo } from "@/lib/pdf/common";
import { parsePageRanges } from "@/lib/pdf/split-pdf";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { getErrorMessage } from "@/lib/workspace/errors";
import { ObjectUrlManager } from "@/lib/workspace/url";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 50 * 1024 * 1024,
  minSizeBytes: 1,
  acceptedExtensions: [".pdf"],
  acceptedMimeTypes: ["application/pdf"],
  maxFiles: 1,
};

type PageScope = "all" | "selected" | "ranges";

export function PdfToExcelTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docInfo, setDocInfo] = useState<PdfDocumentInfo | null>(null);
  const [processingStage, setProcessingStage] = useState<string>("Reading PDF...");

  // Configuration State
  const [scope, setScope] = useState<PageScope>("all");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set([1]));
  const [rangeString, setRangeString] = useState<string>("1-2");

  // Results State
  const [result, setResult] = useState<PdfToExcelResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Object URL Manager for clean memory lifecycle
  const [urlManager] = useState(() => new ObjectUrlManager());

  useEffect(() => {
    return () => {
      urlManager.revokeAll();
    };
  }, [urlManager]);

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
          "This PDF is password protected. Please unlock it using the Unlock PDF tool before extracting tables."
        );
      }

      setSelectedFile(file);
      setDocInfo(info);
      setSelectedPages(new Set([1]));
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

  // Live range validation
  const rangeValidation = useMemo(() => {
    if (!docInfo || scope !== "ranges") return null;
    return parsePageRanges(rangeString, docInfo.pageCount);
  }, [docInfo, scope, rangeString]);

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

  const handleConvert = async () => {
    if (!selectedFile || !docInfo) return;

    if (scope === "selected" && selectedPages.size === 0) {
      setGeneralError("Please select at least one page for table extraction.");
      return;
    }

    if (scope === "ranges" && (!rangeValidation || !rangeValidation.isValid)) {
      setGeneralError(rangeValidation?.error || "Please provide a valid page range.");
      return;
    }

    setStatus("processing");
    setGeneralError(null);
    setProcessingStage("Reading PDF...");

    try {
      setProcessingStage("Analyzing pages...");
      await new Promise((r) => setTimeout(r, 60));

      setProcessingStage("Detecting tables & coordinates...");
      await new Promise((r) => setTimeout(r, 60));

      setProcessingStage("Creating Excel workbook...");
      const res = await convertPdfToExcel(selectedFile, {
        scope,
        selectedPages: Array.from(selectedPages),
        rangeString,
      });

      setProcessingStage("Validating workbook...");
      await new Promise((r) => setTimeout(r, 60));

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
    urlManager.revokeAll();
    setSelectedFile(null);
    setDocInfo(null);
    setResult(null);
    setGeneralError(null);
    setStatus("idle");
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* 1. Upload Dropzone */}
      {!selectedFile && status !== "processing" && (
        <div className="space-y-4">
          <FileDropzone
            onFilesSelected={handleFilesSelected}
            validationOptions={DROPZONE_VALIDATION}
            title="Drag and drop your PDF to extract tables"
            subtitle="Converts structured tabular data from invoices, statements, and reports into a real Excel workbook (.xlsx)."
          />

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>100% In-Browser Private Processing</span>
            </div>
            <p>
              Your document is parsed locally inside your browser sandbox. No PDF data or financial figures
              are ever uploaded to third-party cloud servers or OCR APIs.
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* 2. File Selected & Scope Configuration */}
      {selectedFile && docInfo && status !== "success" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          {/* File Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Table className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate max-w-sm sm:max-w-md">
                  {selectedFile.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{formatBytes(selectedFile.size)}</span>
                  <span>•</span>
                  <span>{docInfo.pdfVersion}</span>
                  <span>•</span>
                  <span>{docInfo.pageCount} pages</span>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Choose Different File
            </Button>
          </div>

          {/* Scope Selection Tabs */}
          <div className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pages to Extract
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  scope === "all"
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-border hover:bg-muted/40 text-foreground"
                }`}
              >
                All Pages ({docInfo.pageCount})
              </button>

              <button
                type="button"
                onClick={() => setScope("selected")}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  scope === "selected"
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-border hover:bg-muted/40 text-foreground"
                }`}
              >
                Select Pages
              </button>

              <button
                type="button"
                onClick={() => setScope("ranges")}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  scope === "ranges"
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-border hover:bg-muted/40 text-foreground"
                }`}
              >
                Page Range
              </button>
            </div>

            {/* Selected Pages Grid */}
            {scope === "selected" && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Selected {selectedPages.size} of {docInfo.pageCount} pages
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllPages}
                      className="text-xs text-primary hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-xs text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={clearPageSelection}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto p-2 rounded-xl border border-border/60 bg-muted/20 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                  {Array.from({ length: docInfo.pageCount }, (_, i) => i + 1).map((pageNum) => {
                    const isSelected = selectedPages.has(pageNum);
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => togglePage(pageNum)}
                        className={`h-9 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-background border border-border/80 text-foreground hover:bg-muted"
                        }`}
                        aria-pressed={isSelected}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Range Input */}
            {scope === "ranges" && (
              <div className="space-y-2 pt-2">
                <label
                  htmlFor="excel-range-input"
                  className="block text-xs font-medium text-foreground"
                >
                  Enter comma-separated pages or ranges (e.g. 1-3, 5):
                </label>
                <input
                  id="excel-range-input"
                  type="text"
                  value={rangeString}
                  onChange={(e) => setRangeString(e.target.value)}
                  placeholder="1-3, 5"
                  className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {rangeValidation && !rangeValidation.isValid && (
                  <p className="text-xs text-rose-500 font-medium">
                    {rangeValidation.error}
                  </p>
                )}
                {rangeValidation && rangeValidation.isValid && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ Valid: Targeting {rangeValidation.allPageNumbers.length} pages (
                    {rangeValidation.allPageNumbers.join(", ")})
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Technical Scope Notice */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p>
              <strong>Table Structure:</strong> Fixed-layout PDFs do not contain native spreadsheet cells.
              FileForge extracts spatial coordinates, clusters columns, preserves empty cells, and creates separate sheets
              named <em>Page 1 Table 1</em> for detected tabular regions.
            </p>
          </div>

          {/* Processing Indicator */}
          {status === "processing" && (
            <div className="py-4">
              <ProcessingIndicator statusText={processingStage} />
            </div>
          )}

          {/* Action Button */}
          {status !== "processing" && (
            <Button
              onClick={handleConvert}
              className="w-full sm:w-auto h-11 px-8 font-medium gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Extract Tables to Excel (.xlsx)
            </Button>
          )}
        </div>
      )}

      {/* 3. Result View */}
      {status === "success" && result && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border/60">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground">
                Excel Workbook Successfully Created!
              </h3>
              <p className="text-xs text-muted-foreground">
                Genuine OpenXML spreadsheet (.xlsx) ready to open in Microsoft Excel, Google Sheets, or LibreOffice.
              </p>
            </div>
          </div>

          {/* Warnings Banner if applicable */}
          {result.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                {result.warnings.map((w, idx) => (
                  <p key={idx}>{w}</p>
                ))}
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-xs text-muted-foreground">Tables Detected</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">
                {result.tablesDetected}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-xs text-muted-foreground">Rows Extracted</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">
                {result.rowsExtracted}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-xs text-muted-foreground">Sheets Created</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">
                {result.sheetsCreated}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-xs text-muted-foreground">Output Size</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">
                {formatBytes(result.outputSizeBytes)}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              onClick={handleDownload}
              className="w-full sm:w-auto h-11 px-8 font-medium gap-2"
            >
              <Download className="w-4 h-4" />
              Download Excel Workbook (.xlsx)
            </Button>

            <Button
              variant="outline"
              onClick={handleReset}
              className="w-full sm:w-auto h-11 px-6 font-medium gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Convert Another PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
