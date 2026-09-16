"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Download,
  RotateCcw,
  Images,
  ShieldCheck,
  CheckCircle2,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileDropzone,
  ProcessingIndicator,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  convertPdfToJpg,
  PdfToJpgResult,
  PdfToJpgPageMode,
  JpgQualityLevel,
  JpgScaleLevel,
  QUALITY_VALUES,
  SCALE_VALUES,
} from "@/lib/pdf/pdf-to-jpg";
import { getPdfDocumentInfo, PdfDocumentInfo } from "@/lib/pdf/common";
import { parsePageRanges } from "@/lib/pdf/split-pdf";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { getErrorMessage } from "@/lib/workspace/errors";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";
import { cn } from "@/lib/utils";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 50 * 1024 * 1024,
  minSizeBytes: 1,
  acceptedExtensions: [".pdf"],
  acceptedMimeTypes: ["application/pdf"],
  maxFiles: 1,
};

export function PdfToJpgTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docInfo, setDocInfo] = useState<PdfDocumentInfo | null>(null);

  // Settings
  const [mode, setMode] = useState<PdfToJpgPageMode>("all");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set([1]));
  const [rangeString, setRangeString] = useState<string>("1-2");
  const [quality, setQuality] = useState<JpgQualityLevel>("high");
  const [scale, setScale] = useState<JpgScaleLevel>("2x");
  const [processingStage, setProcessingStage] = useState<string>("Reading PDF...");

  // Results
  const [result, setResult] = useState<PdfToJpgResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Clean URLs on unmount or reset
  useEffect(() => {
    return () => {
      if (result) {
        for (const img of result.images) {
          URL.revokeObjectURL(img.previewUrl);
        }
      }
    };
  }, [result]);

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
          "This PDF is password protected. Please remove password protection before converting."
        );
      }

      setSelectedFile(file);
      setDocInfo(info);
      setSelectedPages(new Set([1]));
      setRangeString(info.pageCount > 1 ? `1-${info.pageCount}` : "1");
      setStatus("idle");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setSelectedFile(null);
      setDocInfo(null);
      setStatus("error");
    }
  };

  const rangeValidation = useMemo(() => {
    if (!docInfo || mode !== "ranges") return null;
    return parsePageRanges(rangeString, docInfo.pageCount);
  }, [docInfo, mode, rangeString]);

  const togglePage = (pageNum: number) => {
    setSelectedPages((prev) => {
      const copy = new Set(prev);
      if (copy.has(pageNum)) copy.delete(pageNum);
      else copy.add(pageNum);
      return copy;
    });
  };

  const handleConvert = async () => {
    if (!selectedFile || !docInfo) return;

    setStatus("processing");
    setGeneralError(null);
    setProcessingStage("Reading PDF...");

    try {
      const res = await convertPdfToJpg(selectedFile, {
        mode,
        selectedPages: Array.from(selectedPages),
        rangeString,
        quality,
        scale,
        onProgress: (stage) => setProcessingStage(stage),
      });

      setResult(res);
      setStatus("success");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setStatus("error");
    }
  };

  const handleDownloadAll = () => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  };

  const handleDownloadSingle = (blob: Blob, filename: string) => {
    downloadBlob(blob, filename);
  };

  const handleReset = () => {
    if (result) {
      for (const img of result.images) {
        URL.revokeObjectURL(img.previewUrl);
      }
    }
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
          title="Drop your PDF here to convert to JPG"
          subtitle="Renders pages into crystal-clear JPG images • 100% Client-Side"
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
                {result.isArchive ? <Archive className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  PDF Rendered Successfully!
                </h3>
                <p className="text-xs text-slate-500">
                  Converted {result.pageCount} {result.pageCount === 1 ? "page" : "pages"} in {Math.round(result.executionTimeMs)}ms
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                size="default"
                onClick={handleDownloadAll}
                className="gap-2 shadow-sm font-semibold"
                id="download-pdf-jpg-button"
              >
                <Download className="h-4 w-4" />
                {result.isArchive ? "Download All (ZIP)" : "Download JPG"}
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={handleReset}
                className="gap-2"
                id="convert-another-pdf-jpg-button"
              >
                <RotateCcw className="h-4 w-4" />
                Convert Another
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Pages Rendered
              </span>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {result.pageCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Resolution Scale
              </span>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {SCALE_VALUES[scale].label}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Quality Preset
              </span>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {QUALITY_VALUES[quality].label}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Total Output Size
              </span>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {formatBytes(result.outputSizeBytes)}
              </p>
            </div>
          </div>

          {/* Rendered Page Gallery */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Rendered Page Gallery ({result.images.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-96 overflow-y-auto pr-1">
              {result.images.map((img) => (
                <div
                  key={img.pageNumber}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col justify-between space-y-3"
                >
                  <div className="aspect-3/4 rounded-lg bg-white border border-slate-200 overflow-hidden shadow-2xs flex items-center justify-center">
                    <img
                      src={img.previewUrl}
                      alt={`Page ${img.pageNumber}`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>
                      <span className="font-bold text-slate-900 block">Page {img.pageNumber}</span>
                      <span className="text-[11px] text-slate-500">
                        {img.width} × {img.height} px • {formatBytes(img.sizeBytes)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadSingle(img.blob, img.filename)}
                      className="h-7 px-2.5 text-xs gap-1"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Save
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>PDF rendered locally in browser Canvas. Zero server uploads.</span>
          </div>
        </div>
      )}

      {/* STATE 4: Workspace / Configuration */}
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
              id="change-pdf-to-jpg-file-button"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Change Document
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            {/* Page Selection Mode */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Select Pages to Convert
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup">
                <button
                  type="button"
                  onClick={() => setMode("all")}
                  className={cn(
                    "flex flex-col text-left p-4 rounded-xl border transition-all duration-150",
                    mode === "all"
                      ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-100 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <span className="text-sm font-bold text-slate-900 mb-1">All Pages</span>
                  <span className="text-xs text-slate-500">
                    Convert every page (1 to {docInfo.pageCount}) into JPG pictures.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("selected")}
                  className={cn(
                    "flex flex-col text-left p-4 rounded-xl border transition-all duration-150",
                    mode === "selected"
                      ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-100 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <span className="text-sm font-bold text-slate-900 mb-1">Select Pages</span>
                  <span className="text-xs text-slate-500">
                    Choose specific individual pages from a visual grid.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("ranges")}
                  className={cn(
                    "flex flex-col text-left p-4 rounded-xl border transition-all duration-150",
                    mode === "ranges"
                      ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-100 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <span className="text-sm font-bold text-slate-900 mb-1">Page Ranges</span>
                  <span className="text-xs text-slate-500">
                    Type a range expression like 1-3, 5, 8-10.
                  </span>
                </button>
              </div>
            </div>

            {/* Selected mode chips */}
            {mode === "selected" && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700 block">
                  Click pages to convert ({selectedPages.size} selected):
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-1 border rounded-xl border-slate-200 bg-slate-50/50">
                  {Array.from({ length: docInfo.pageCount }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => togglePage(page)}
                      className={cn(
                        "p-2 rounded-lg text-xs font-bold border transition-colors",
                        selectedPages.has(page)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      P. {page}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ranges mode input */}
            {mode === "ranges" && (
              <div className="space-y-2 pt-2 border-t border-slate-100 max-w-sm">
                <label className="text-xs font-semibold text-slate-700 block">
                  Page Range Expression
                </label>
                <input
                  type="text"
                  value={rangeString}
                  onChange={(e) => setRangeString(e.target.value)}
                  placeholder="e.g. 1-3, 5, 8-10"
                  className={cn(
                    "w-full px-3 py-2 text-xs rounded-xl border bg-white text-slate-900 focus:outline-none focus:ring-2",
                    rangeValidation?.isValid
                      ? "border-slate-300 focus:ring-blue-500"
                      : "border-rose-400 bg-rose-50/20"
                  )}
                />
                {rangeValidation && !rangeValidation.isValid && (
                  <p className="text-xs text-rose-600">{rangeValidation.error}</p>
                )}
              </div>
            )}

            {/* Quality & Resolution Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Image Resolution / DPI
                </label>
                <select
                  value={scale}
                  onChange={(e) => setScale(e.target.value as JpgScaleLevel)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1x">1× Standard (~72 DPI - Smallest Size)</option>
                  <option value="1.5x">1.5× Balanced (~108 DPI - Crisp Web)</option>
                  <option value="2x">2× High Resolution (~144 DPI - Recommended)</option>
                  <option value="3x">3× Ultra Crisp (~216 DPI - Print Quality)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  JPEG Compression Quality
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as JpgQualityLevel)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="standard">Standard (80% Quality - Faster, smaller files)</option>
                  <option value="high">High (92% Quality - Recommended balance)</option>
                  <option value="maximum">Maximum (98% Quality - Studio quality)</option>
                </select>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                White background applied • High-DPI canvas rendering
              </p>
              <Button
                size="lg"
                onClick={handleConvert}
                disabled={
                  (mode === "selected" && selectedPages.size === 0) ||
                  (mode === "ranges" && (!rangeValidation || !rangeValidation.isValid))
                }
                className="gap-2 shadow-sm font-semibold text-sm px-6"
                id="convert-pdf-to-jpg-submit-button"
              >
                <Images className="h-4 w-4" />
                Render Pages to JPG
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
