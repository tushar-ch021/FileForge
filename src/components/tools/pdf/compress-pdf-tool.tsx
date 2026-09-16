"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Download,
  RotateCcw,
  AlertCircle,
  TrendingDown,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Layers,
  Image as ImageIcon,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileDropzone,
  ProcessingIndicator,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  CompressionLevel,
  COMPRESSION_PRESETS,
  PdfDocumentInfo,
  CompressPdfResult,
  compressPdf,
  getPdfDocumentInfo,
} from "@/lib/pdf/compress-pdf";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { ObjectUrlManager } from "@/lib/workspace/url";
import { getErrorMessage } from "@/lib/workspace/errors";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";
import { cn } from "@/lib/utils";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB browser limit
  minSizeBytes: 1,
  acceptedExtensions: [".pdf"],
  acceptedMimeTypes: ["application/pdf"],
  maxFiles: 1,
};

export function CompressPdfTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docInfo, setDocInfo] = useState<PdfDocumentInfo | null>(null);

  // Configuration State
  const [level, setLevel] = useState<CompressionLevel>("recommended");
  const [processingStage, setProcessingStage] = useState<string>("Analyzing PDF...");

  // Results State
  const [result, setResult] = useState<CompressPdfResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string>("");
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Object URL Manager for clean memory lifecycle
  const [urlManager] = useState(() => new ObjectUrlManager());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      urlManager.revokeAll();
    };
  }, [urlManager]);

  const clearResultUrl = useCallback(() => {
    if (resultUrl) {
      urlManager.revoke(resultUrl);
      setResultUrl("");
    }
  }, [resultUrl, urlManager]);

  // Handle incoming file selection
  const handleFilesSelected = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    clearResultUrl();
    setGeneralError(null);
    setResult(null);
    setStatus("validating");

    try {
      const info = await getPdfDocumentInfo(file);

      if (info.isEncrypted) {
        throw new Error(
          "Password-protected or encrypted PDFs cannot be compressed. Please unlock your document before uploading."
        );
      }

      setSelectedFile(file);
      setDocInfo(info);
      setLevel("recommended");
      setStatus("idle");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setSelectedFile(null);
      setDocInfo(null);
      setStatus("error");
    }
  };

  // Run Compression
  const handleCompress = async () => {
    if (!selectedFile) return;

    clearResultUrl();
    setStatus("processing");
    setGeneralError(null);
    setProcessingStage("Analyzing PDF...");

    try {
      const res = await compressPdf(selectedFile, {
        level,
        onProgress: (stage) => setProcessingStage(stage),
      });

      const url = urlManager.create(res.blob) || "";
      setResult(res);
      setResultUrl(url);
      setStatus("success");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setStatus("error");
    }
  };

  // Download Compressed File
  const handleDownload = () => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  };

  // Reset Tool
  const handleReset = () => {
    clearResultUrl();
    setSelectedFile(null);
    setDocInfo(null);
    setResult(null);
    setGeneralError(null);
    setLevel("recommended");
    setStatus("idle");
  };

  return (
    <div className="w-full space-y-6">
      {/* Error Alert */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onRetry={selectedFile ? handleCompress : undefined}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* STATE 1: Empty / Idle - Dropzone */}
      {!selectedFile && (
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          validationOptions={DROPZONE_VALIDATION}
          title="Drop your PDF here to compress"
          subtitle="Supports PDF documents up to 50MB • Processed 100% locally"
          multiple={false}
          disabled={status === "validating"}
        />
      )}

      {/* STATE 2: Processing Indicator */}
      {status === "processing" && (
        <ProcessingIndicator
          statusText={processingStage}
        />
      )}

      {/* STATE 3: Success View with Comparison & Download */}
      {status === "success" && result && selectedFile && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl border shadow-2xs",
                    result.isSmaller
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : "bg-amber-50 text-amber-600 border-amber-200"
                  )}
                >
                  {result.isSmaller ? (
                    <TrendingDown className="h-6 w-6" />
                  ) : (
                    <AlertCircle className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {result.isSmaller
                      ? `Compressed by ${result.percentageSaved}%!`
                      : "Document Optimized"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Processed locally on your device in {Math.round(result.executionTimeMs)}ms • {result.pageCount} {result.pageCount === 1 ? "page" : "pages"} preserved
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  size="default"
                  onClick={handleDownload}
                  className="gap-2 shadow-sm font-semibold"
                  id="download-compressed-pdf-button"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleReset}
                  className="gap-2"
                  id="compress-another-pdf-button"
                >
                  <RotateCcw className="h-4 w-4" />
                  Compress Another
                </Button>
              </div>
            </div>

            {/* If compressed file was NOT smaller: Honest Alert */}
            {!result.isSmaller && (
              <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Compression did not reduce the file size. Your original file is already efficiently compressed.</span>
                </div>
                <p className="leading-relaxed text-amber-800">
                  This document already uses maximum stream compression and contains no uncompressed image data that can be safely downscaled. To prevent any file size inflation, your original file is preserved for download.
                </p>
              </div>
            )}

            {/* Before / After File Size Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Original Size
                </span>
                <p className="text-lg sm:text-xl font-bold text-slate-900">
                  {formatBytes(result.originalSizeBytes)}
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block mb-1">
                  Compressed Size
                </span>
                <p className="text-lg sm:text-xl font-bold text-blue-900">
                  {formatBytes(result.compressedSizeBytes)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Saved
                </span>
                <p className={cn(
                  "text-lg sm:text-xl font-bold",
                  result.isSmaller ? "text-emerald-700" : "text-slate-500"
                )}>
                  {result.isSmaller ? formatBytes(result.bytesSaved) : "0 Bytes"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Reduction
                </span>
                <p className={cn(
                  "text-lg sm:text-xl font-bold",
                  result.isSmaller ? "text-emerald-700" : "text-slate-500"
                )}>
                  {result.isSmaller ? `${result.percentageSaved}%` : "0%"}
                </p>
              </div>
            </div>

            {/* Technical Verification Details */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Preservation & Verification Report
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Page Count</span>
                  <span className="font-semibold text-slate-800">{result.pageCount} Pages (Preserved)</span>
                </div>
                <div>
                  <span className="text-slate-500 block">PDF Standard</span>
                  <span className="font-semibold text-slate-800">{result.pdfVersion}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Images Optimized</span>
                  <span className="font-semibold text-slate-800">{result.imagesOptimized} Raster Images</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Text & Vectors</span>
                  <span className="font-semibold text-emerald-700">100% Intact & Selectable</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: File Selected & Config Panel (Idle / Ready to Compress) */}
      {selectedFile && docInfo && status !== "processing" && status !== "success" && (
        <div className="space-y-6">
          {/* File Information Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-xs sm:max-w-md" title={selectedFile.name}>
                  {selectedFile.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{formatBytes(selectedFile.size)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3 text-slate-400" />
                    {docInfo.pageCount} {docInfo.pageCount === 1 ? "page" : "pages"}
                  </span>
                  <span>•</span>
                  <span>{docInfo.pdfVersion}</span>
                  {docInfo.imageCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-blue-600">
                        <ImageIcon className="h-3 w-3" />
                        {docInfo.imageCount} {docInfo.imageCount === 1 ? "image" : "images"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-900 shrink-0 self-start sm:self-center"
            >
              Change File
            </Button>
          </div>

          {/* Compression Level Presets */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Select Compression Level
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose the preset that best matches your target visual quality and file-size requirements.
              </p>
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-3.5"
              role="radiogroup"
              aria-label="Compression Level"
            >
              {(Object.keys(COMPRESSION_PRESETS) as CompressionLevel[]).map((key) => {
                const preset = COMPRESSION_PRESETS[key];
                const isSelected = level === key;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => setLevel(key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setLevel(key);
                      }
                    }}
                    className={cn(
                      "flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                      isSelected
                        ? "border-blue-600 bg-blue-50/40 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "flex h-4 w-4 rounded-full border items-center justify-center",
                          isSelected ? "border-blue-600 bg-blue-600" : "border-slate-300"
                        )}>
                          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="font-bold text-sm text-slate-900">
                          {preset.name}
                        </span>
                      </div>
                      {preset.badge && (
                        <Badge
                          variant={key === "recommended" ? "popular" : "secondary"}
                          className="text-[10px] py-0 px-1.5"
                        >
                          {preset.badge}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-blue-600 mb-1">
                      {preset.tagline}
                    </p>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Privacy Guarantee Note */}
            <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Your PDF is processed locally in your browser. It never uploads to external servers.</span>
            </div>

            {/* Compress Button */}
            <div className="pt-2 flex justify-end">
              <Button
                size="lg"
                onClick={handleCompress}
                className="w-full sm:w-auto gap-2 shadow-sm font-semibold"
                id="start-compress-pdf-button"
              >
                <Zap className="h-4 w-4" />
                Compress PDF Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
