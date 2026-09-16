"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileArchive,
  Download,
  RotateCcw,
  Sparkles,
  AlertCircle,
  FileImage,
  Sliders,
  CheckCircle2,
  ArrowRight,
  Info,
  TrendingDown,
  Layers,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  FileDropzone,
  ProcessingIndicator,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  CompressibleFormat,
  OutputFormatOption,
  COMPRESSION_PRESETS,
  CompressImageResult,
  compressImage,
  generateCompressedFilename,
  detectImageFormat,
  getImageMetadata,
  ImageMetadata,
} from "@/lib/image/compress-image";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { ObjectUrlManager } from "@/lib/workspace/url";
import { getErrorMessage } from "@/lib/workspace/errors";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";
import { cn } from "@/lib/utils";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  minSizeBytes: 1,
  acceptedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFiles: 1,
};

const FORMAT_OPTIONS: { id: OutputFormatOption; label: string; desc: string }[] = [
  { id: "original", label: "Keep Original", desc: "Preserve original file format" },
  { id: "image/webp", label: "WebP", desc: "Best compression & alpha support" },
  { id: "image/jpeg", label: "JPG", desc: "Universal lossy compression" },
  { id: "image/png", label: "PNG", desc: "Lossless (limited size reduction)" },
];

export function CompressImageTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceMetadata, setSourceMetadata] = useState<ImageMetadata | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string>("");

  // Compression Configuration State
  const [quality, setQuality] = useState<number>(80);
  const [activePreset, setActivePreset] = useState<"high" | "balanced" | "strong" | "custom">("balanced");
  const [outputFormat, setOutputFormat] = useState<OutputFormatOption>("original");

  // Result & Processing State
  const [result, setResult] = useState<CompressImageResult | null>(null);
  const [resultPreviewUrl, setResultPreviewUrl] = useState<string>("");
  const [activePreviewTab, setActivePreviewTab] = useState<"compressed" | "original">("compressed");
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Dedicated ObjectUrlManager to prevent memory leaks
  const [urlManager] = useState(() => new ObjectUrlManager());

  // Revoke URLs on unmount
  useEffect(() => {
    return () => {
      urlManager.revokeAll();
    };
  }, [urlManager]);

  // Cleanup active preview URLs
  const clearPreviewUrls = useCallback(() => {
    if (sourcePreviewUrl) {
      urlManager.revoke(sourcePreviewUrl);
      setSourcePreviewUrl("");
    }
    if (resultPreviewUrl) {
      urlManager.revoke(resultPreviewUrl);
      setResultPreviewUrl("");
    }
  }, [sourcePreviewUrl, resultPreviewUrl, urlManager]);

  // Handle file selection
  const handleFilesSelected = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    clearPreviewUrls();
    setGeneralError(null);
    setStatus("validating");

    try {
      const meta = await getImageMetadata(file);
      const previewUrl = urlManager.create(file) || "";

      setSelectedFile(file);
      setSourceMetadata(meta);
      setSourcePreviewUrl(previewUrl);

      // Default to Balanced 80% and keep original format
      setQuality(80);
      setActivePreset("balanced");
      setOutputFormat("original");
      setStatus("idle");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setSelectedFile(null);
      setSourceMetadata(null);
      setStatus("error");
    }
  };

  // Handle preset selection
  const handlePresetSelect = (presetId: "high" | "balanced" | "strong") => {
    setActivePreset(presetId);
    const found = COMPRESSION_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setQuality(found.quality);
    }
  };

  // Handle custom slider change
  const handleSliderChange = (newVal: number) => {
    setQuality(newVal);
    const match = COMPRESSION_PRESETS.find((p) => p.quality === newVal);
    setActivePreset(match ? match.id : "custom");
  };

  // Execute Compression
  const handleCompress = async (overrideFormat?: OutputFormatOption, overrideQuality?: number) => {
    if (!selectedFile || !sourceMetadata) return;

    const targetFmt = overrideFormat ?? outputFormat;
    const targetQ = overrideQuality ?? quality;

    setStatus("processing");
    setGeneralError(null);

    try {
      const res = await compressImage(selectedFile, {
        quality: targetQ,
        outputFormat: targetFmt,
        backgroundColor: "#ffffff",
      });

      const resUrl = urlManager.create(res.blob) || "";
      setResult(res);
      setResultPreviewUrl(resUrl);
      setActivePreviewTab("compressed");
      setStatus("success");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setStatus("error");
    }
  };

  // Download Compressed Image
  const handleDownload = () => {
    if (!result || !selectedFile) return;
    const filename = generateCompressedFilename(selectedFile.name, result.extension);
    downloadBlob(result.blob, filename);
  };

  // Reset Tool
  const handleReset = () => {
    clearPreviewUrls();
    setSelectedFile(null);
    setSourceMetadata(null);
    setResult(null);
    setGeneralError(null);
    setQuality(80);
    setActivePreset("balanced");
    setOutputFormat("original");
    setStatus("idle");
  };

  const resolvedTargetFormat: CompressibleFormat =
    !selectedFile || outputFormat === "original"
      ? selectedFile
        ? detectImageFormat(selectedFile)
        : "image/jpeg"
      : outputFormat;

  const isPngOutput = resolvedTargetFormat === "image/png";

  return (
    <div className="w-full space-y-6">
      {/* Error Alert Display */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onRetry={selectedFile ? () => handleCompress() : undefined}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* STATE 1: Empty / Idle - Dropzone */}
      {!selectedFile && (
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          validationOptions={DROPZONE_VALIDATION}
          title="Drop your image here to compress"
          subtitle="Supports JPG, PNG, and WebP up to 50MB"
          multiple={false}
          disabled={status === "validating"}
        />
      )}

      {/* STATE 2: Processing Indicator */}
      {status === "processing" && (
        <ProcessingIndicator
          statusText="Compressing image locally in your browser..."
        />
      )}

      {/* STATE 3: Success View with Comparison & Download */}
      {status === "success" && result && selectedFile && sourceMetadata && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            {/* Success Header */}
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
                      : "Compression Result Ready"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Processed on your device in {Math.round(result.executionTimeMs)}ms • Original dimensions preserved ({result.width} × {result.height} px)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  size="default"
                  onClick={handleDownload}
                  className="gap-2 shadow-sm font-semibold"
                  id="download-compressed-image-button"
                >
                  <Download className="h-4 w-4" />
                  Download Image
                </Button>
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleReset}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Compress Another
                </Button>
              </div>
            </div>

            {/* If compressed file is NOT smaller: Clear Guidance Alert */}
            {!result.isSmaller && (
              <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                  <Info className="h-4 w-4 text-amber-600" />
                  <span>The compressed file is not smaller than the original</span>
                </div>
                <p className="leading-relaxed">
                  The original image is already heavily compressed, or the selected format (such as PNG) uses lossless compression that does not reduce size through canvas re-encoding.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="accent"
                    onClick={() => {
                      setOutputFormat("image/webp");
                      handleCompress("image/webp", 80);
                    }}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    Compress as WebP (Recommended)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setOutputFormat("image/jpeg");
                      handleCompress("image/jpeg", 75);
                    }}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    Compress as JPG (75% Quality)
                  </Button>
                </div>
              </div>
            )}

            {/* Comparison Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
              {/* Original Stats Card */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Original Image
                  </span>
                  <Badge variant="secondary" className="text-[11px]">
                    {sourceMetadata.format.replace("image/", "").toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-slate-800 truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                  <span>Resolution:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {sourceMetadata.width} × {sourceMetadata.height} px
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>File Size:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatBytes(sourceMetadata.fileSize)}
                  </span>
                </div>
              </div>

              {/* Compressed Stats Card */}
              <div
                className={cn(
                  "rounded-xl border p-4 space-y-2",
                  result.isSmaller
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-slate-200 bg-slate-50/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      result.isSmaller ? "text-emerald-700" : "text-slate-600"
                    )}
                  >
                    Compressed Result
                  </span>
                  <Badge
                    variant={result.isSmaller ? "clientSide" : "secondary"}
                    className="text-[11px]"
                  >
                    {result.extension.toUpperCase()}
                  </Badge>
                </div>
                <p
                  className="text-sm font-medium text-slate-800 truncate"
                  title={generateCompressedFilename(selectedFile.name, result.extension)}
                >
                  {generateCompressedFilename(selectedFile.name, result.extension)}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                  <span>Resolution:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {result.width} × {result.height} px (Unchanged)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>New File Size:</span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      result.isSmaller ? "text-emerald-700" : "text-slate-900"
                    )}
                  >
                    {formatBytes(result.sizeBytes)}
                  </span>
                </div>
              </div>
            </div>

            {/* Savings Badge Bar */}
            {result.isSmaller ? (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>
                    Successfully reduced file size by <strong>{result.percentageSaved}%</strong>.
                  </span>
                </div>
                <span className="font-semibold bg-white border border-emerald-200 text-emerald-800 px-2.5 py-0.5 rounded-md">
                  Saved {formatBytes(result.bytesSaved)}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600">
                <span>Output size is {formatBytes(result.sizeBytes)} ({formatBytes(Math.abs(result.bytesSaved))} difference).</span>
                <span className="font-medium text-slate-500">No data reduction achieved with current settings</span>
              </div>
            )}

            {/* Preview Toggle Box */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Visual Comparison
                </span>
                <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab("compressed")}
                    className={cn(
                      "px-3 py-1 rounded-md font-semibold transition-colors",
                      activePreviewTab === "compressed"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Compressed ({formatBytes(result.sizeBytes)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab("original")}
                    className={cn(
                      "px-3 py-1 rounded-md font-semibold transition-colors",
                      activePreviewTab === "original"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Original ({formatBytes(sourceMetadata.fileSize)})
                  </button>
                </div>
              </div>

              <div className="relative flex items-center justify-center p-4 rounded-xl border border-slate-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 overflow-hidden min-h-[260px] max-h-[460px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activePreviewTab === "compressed" ? resultPreviewUrl : sourcePreviewUrl}
                  alt={activePreviewTab === "compressed" ? "Compressed preview" : "Original preview"}
                  className="max-h-[420px] max-w-full object-contain rounded-lg shadow-sm"
                />
                <span className="absolute bottom-3 right-3 text-[11px] font-mono bg-slate-900/80 text-white px-2 py-0.5 rounded-md backdrop-blur-xs">
                  Showing {activePreviewTab === "compressed" ? "Optimized" : "Original"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: File Loaded - Compression Controls */}
      {selectedFile && sourceMetadata && status !== "success" && status !== "processing" && (
        <div className="space-y-6">
          {/* File Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-2xs text-blue-600">
                <FileImage className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 truncate max-w-[220px] sm:max-w-md">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-500">
                  {sourceMetadata.width} × {sourceMetadata.height} px • {formatBytes(selectedFile.size)} • {sourceMetadata.format.replace("image/", "").toUpperCase()}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-xs text-slate-600 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Change Image
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Image Preview Thumbnail */}
            <div className="lg:col-span-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Original Preview
              </span>
              <div className="relative flex items-center justify-center p-3 rounded-2xl border border-slate-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 overflow-hidden h-[260px] sm:h-[300px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sourcePreviewUrl}
                  alt="Original preview"
                  className="max-h-full max-w-full object-contain rounded-lg shadow-2xs"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Original Dimensions: {sourceMetadata.width} × {sourceMetadata.height} px</span>
                <span>Size: {formatBytes(sourceMetadata.fileSize)}</span>
              </div>
            </div>

            {/* Right Column: Compression Controls */}
            <div className="lg:col-span-7 space-y-6">
              {/* Compression Quality Card */}
              <Card className="p-5 space-y-5 border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      Compression Quality
                    </h4>
                  </div>
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                    {quality}%
                  </span>
                </div>

                {/* Preset Quality Buttons */}
                <div className="grid grid-cols-3 gap-2.5">
                  {COMPRESSION_PRESETS.map((preset) => {
                    const isSelected = activePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handlePresetSelect(preset.id as "high" | "balanced" | "strong")}
                        className={cn(
                          "flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 text-blue-950"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold">{preset.label}</span>
                          <span className="font-mono text-[10px] font-semibold text-slate-500">
                            {preset.quality}%
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                          {preset.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Quality Slider */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="compression-quality-slider"
                      className="font-bold text-slate-700 uppercase tracking-wider"
                    >
                      Fine-Tune Quality
                    </label>
                    <span className="text-slate-500 font-medium">
                      Lower quality = Smaller file
                    </span>
                  </div>

                  <input
                    id="compression-quality-slider"
                    type="range"
                    min={10}
                    max={95}
                    step={1}
                    value={quality}
                    onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
                    className="w-full accent-blue-600 cursor-pointer"
                    aria-label="Image compression quality slider"
                  />

                  <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                    <span>10% (Maximum compression)</span>
                    <span>80% (Balanced)</span>
                    <span>95% (High clarity)</span>
                  </div>
                </div>
              </Card>

              {/* Output Format Card */}
              <Card className="p-5 space-y-4 border-slate-200">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Output Format
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FORMAT_OPTIONS.map((opt) => {
                    const isSelected = outputFormat === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setOutputFormat(opt.id)}
                        className={cn(
                          "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                          isSelected
                            ? "border-blue-600 bg-blue-50/60 text-blue-950 ring-2 ring-blue-600/20 font-bold"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 font-medium"
                        )}
                      >
                        <span className="text-xs font-bold">{opt.label}</span>
                        <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Transparency Notice for JPG */}
                {resolvedTargetFormat === "image/jpeg" && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50/90 rounded-xl border border-amber-200/80 text-xs text-amber-900">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      JPG does not support transparency. Transparent areas will be filled with a solid white background. To preserve transparency, select <strong>WebP</strong> or <strong>Keep Original</strong>.
                    </span>
                  </div>
                )}

                {/* PNG Guidance Note */}
                {isPngOutput && (
                  <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                    <HelpCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      PNG is a lossless format. Browser native PNG encoding does not support lossy quality reduction. For optimal compression, we recommend selecting <strong>WebP</strong>.
                    </span>
                  </div>
                )}
              </Card>

              {/* Action Button */}
              <Button
                type="button"
                size="lg"
                onClick={() => handleCompress()}
                className="w-full text-base font-bold shadow-sm gap-2 h-12"
                id="compress-image-button"
              >
                <FileArchive className="h-5 w-5" />
                Compress Image
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
