"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Download,
  RotateCcw,
  Sparkles,
  FileImage,
  Sliders,
  CheckCircle2,
  ArrowRight,
  Info,
  Layers,
  Palette,
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
  ConvertFormat,
  CONVERT_FORMATS,
  ConvertImageResult,
  convertImage,
  generateConvertedFilename,
  getImageMetadata,
  ImageMetadata,
} from "@/lib/image/image-converter";
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

const BACKGROUND_PRESETS = [
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
  { label: "Light Gray", value: "#f3f4f6" },
  { label: "Dark Gray", value: "#1f2937" },
];

export function ImageConverterTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceMetadata, setSourceMetadata] = useState<ImageMetadata | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string>("");

  // Conversion Settings State
  const [targetFormat, setTargetFormat] = useState<ConvertFormat>("image/webp");
  const [quality, setQuality] = useState<number>(80);
  const [backgroundColor, setBackgroundColor] = useState<string>("#ffffff");

  // Result & Processing State
  const [result, setResult] = useState<ConvertImageResult | null>(null);
  const [resultPreviewUrl, setResultPreviewUrl] = useState<string>("");
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

      // Choose intelligent target format (different from source)
      if (meta.format === "image/png") {
        setTargetFormat("image/webp");
      } else if (meta.format === "image/jpeg") {
        setTargetFormat("image/png");
      } else {
        // webp
        setTargetFormat("image/png");
      }

      setQuality(80);
      setBackgroundColor("#ffffff");
      setStatus("idle");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setSelectedFile(null);
      setSourceMetadata(null);
      setStatus("error");
    }
  };

  // Execute Conversion
  const handleConvert = async () => {
    if (!selectedFile || !sourceMetadata) return;

    setStatus("processing");
    setGeneralError(null);

    try {
      const res = await convertImage(selectedFile, {
        targetFormat,
        quality,
        backgroundColor,
      });

      const resUrl = urlManager.create(res.blob) || "";
      setResult(res);
      setResultPreviewUrl(resUrl);
      setStatus("success");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setStatus("error");
    }
  };

  // Download Converted Image
  const handleDownload = () => {
    if (!result || !selectedFile) return;
    const filename = generateConvertedFilename(selectedFile.name, result.extension);
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
    setBackgroundColor("#ffffff");
    setStatus("idle");
  };

  // Filter available formats to exclude source format (no redundant conversion)
  const availableFormats = sourceMetadata
    ? CONVERT_FORMATS.filter((f) => f.format !== sourceMetadata.format)
    : CONVERT_FORMATS;

  const selectedTargetConfig = CONVERT_FORMATS.find((f) => f.format === targetFormat);
  const isConvertingToJpeg = targetFormat === "image/jpeg";

  return (
    <div className="w-full space-y-6">
      {/* Error Alert Display */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onRetry={selectedFile ? handleConvert : undefined}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* STATE 1: Empty / Idle - Dropzone */}
      {!selectedFile && (
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          validationOptions={DROPZONE_VALIDATION}
          title="Drop your image here to convert"
          subtitle="Supports JPG, PNG, and WebP up to 50MB"
          multiple={false}
          disabled={status === "validating"}
        />
      )}

      {/* STATE 2: Processing Indicator */}
      {status === "processing" && (
        <ProcessingIndicator
          statusText="Converting image format in your browser..."
        />
      )}

      {/* STATE 3: Success View with Comparison & Download */}
      {status === "success" && result && selectedFile && sourceMetadata && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            {/* Success Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Converted to {result.extension.toUpperCase()} Successfully!
                  </h3>
                  <p className="text-xs text-slate-500">
                    Processed locally in {Math.round(result.executionTimeMs)}ms • Original dimensions preserved ({result.width} × {result.height} px)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  size="default"
                  onClick={handleDownload}
                  className="gap-2 shadow-sm font-semibold"
                  id="download-converted-image-button"
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
                  Convert Another
                </Button>
              </div>
            </div>

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

              {/* Converted Stats Card */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Converted Output
                  </span>
                  <Badge variant="clientSide" className="text-[11px]">
                    {result.extension.toUpperCase()}
                  </Badge>
                </div>
                <p
                  className="text-sm font-medium text-slate-800 truncate"
                  title={generateConvertedFilename(selectedFile.name, result.extension)}
                >
                  {generateConvertedFilename(selectedFile.name, result.extension)}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-blue-100">
                  <span>Resolution:</span>
                  <span className="font-mono font-semibold text-blue-900">
                    {result.width} × {result.height} px (Preserved)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>New File Size:</span>
                  <span className="font-mono font-bold text-blue-900">
                    {formatBytes(result.sizeBytes)}
                  </span>
                </div>
              </div>
            </div>

            {/* Honest Size Metric Indicator */}
            {result.isSmaller ? (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>
                    New format reduced file size by <strong>{result.percentageSaved}%</strong>.
                  </span>
                </div>
                <span className="font-semibold bg-white border border-emerald-200 text-emerald-800 px-2.5 py-0.5 rounded-md">
                  Saved {formatBytes(result.bytesSaved)}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-slate-400" />
                  <span>
                    Converted file is larger than the original (+{formatBytes(Math.abs(result.bytesSaved))}). Format conversion preserves visual data without lossy decimation.
                  </span>
                </div>
                <span className="font-mono text-slate-500 font-medium">
                  {formatBytes(result.sizeBytes)}
                </span>
              </div>
            )}

            {/* Side-by-Side Visual Comparison */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">Side-by-Side Preview</span>
                <span>Both images: {result.width} × {result.height} px</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Preview */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Original ({sourceMetadata.format.replace("image/", "").toUpperCase()})
                  </span>
                  <div className="relative flex items-center justify-center p-3 rounded-xl border border-slate-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 overflow-hidden h-[240px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sourcePreviewUrl}
                      alt="Original preview"
                      className="max-h-full max-w-full object-contain rounded-md shadow-xs"
                    />
                  </div>
                </div>

                {/* Converted Preview */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    Converted ({result.extension.toUpperCase()})
                  </span>
                  <div className="relative flex items-center justify-center p-3 rounded-xl border border-blue-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 overflow-hidden h-[240px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resultPreviewUrl}
                      alt="Converted preview"
                      className="max-h-full max-w-full object-contain rounded-md shadow-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: File Loaded - Format & Quality Settings */}
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
                  Current Format: {sourceMetadata.format.replace("image/", "").toUpperCase()} • {sourceMetadata.width} × {sourceMetadata.height} px • {formatBytes(selectedFile.size)}
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
                Original Image
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
                <span>Dimensions: {sourceMetadata.width} × {sourceMetadata.height} px</span>
                <span>Size: {formatBytes(sourceMetadata.fileSize)}</span>
              </div>
            </div>

            {/* Right Column: Converter Controls */}
            <div className="lg:col-span-7 space-y-6">
              {/* Target Format Selector Card */}
              <Card className="p-5 space-y-4 border-slate-200">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Convert To
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableFormats.map((f) => {
                    const isSelected = targetFormat === f.format;
                    return (
                      <button
                        key={f.format}
                        type="button"
                        onClick={() => setTargetFormat(f.format)}
                        className={cn(
                          "flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 text-blue-950 font-semibold"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm font-bold">{f.label}</span>
                          <Badge
                            variant={f.supportsTransparency ? "clientSide" : "secondary"}
                            className="text-[10px]"
                          >
                            {f.supportsTransparency ? "Transparency" : "Solid Alpha"}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 leading-normal">
                          {f.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Transparency Protection Warning for JPEG */}
                {isConvertingToJpeg && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-start gap-2 p-3 bg-amber-50/90 rounded-xl border border-amber-200/80 text-xs text-amber-900">
                      <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        JPG does not support transparency. Transparent areas will be rendered with your chosen background color.
                      </span>
                    </div>

                    {/* Background Color Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label
                          htmlFor="bg-color-picker"
                          className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"
                        >
                          <Palette className="h-3.5 w-3.5 text-slate-500" />
                          Background Color
                        </label>
                        <span className="font-mono text-[11px] text-slate-500 uppercase font-semibold">
                          {backgroundColor}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          id="bg-color-picker"
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="h-9 w-12 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                          aria-label="Choose background color for JPEG"
                        />

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {BACKGROUND_PRESETS.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => setBackgroundColor(p.value)}
                              className={cn(
                                "text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer",
                                backgroundColor.toLowerCase() === p.value.toLowerCase()
                                  ? "bg-slate-900 text-white border-slate-900 font-semibold"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                              )}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Quality Settings Card (Only for lossy formats) */}
              <Card className="p-5 space-y-4 border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      Encoding Quality
                    </h4>
                  </div>
                  {selectedTargetConfig?.supportsQuality ? (
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                      {quality}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">
                      Lossless (N/A)
                    </span>
                  )}
                </div>

                {selectedTargetConfig?.supportsQuality ? (
                  <div className="space-y-2">
                    <input
                      id="convert-quality-slider"
                      type="range"
                      min={10}
                      max={100}
                      step={1}
                      value={quality}
                      onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                      className="w-full accent-blue-600 cursor-pointer"
                      aria-label="Encoding quality slider"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                      <span>10% (Smaller file)</span>
                      <span>80% (Recommended)</span>
                      <span>100% (Maximum clarity)</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    PNG uses lossless Deflate compression. Quality slider is not applicable.
                  </p>
                )}
              </Card>

              {/* Action Button */}
              <Button
                type="button"
                size="lg"
                onClick={handleConvert}
                className="w-full text-base font-bold shadow-sm gap-2 h-12"
                id="convert-image-button"
              >
                <RefreshCw className="h-5 w-5" />
                Convert to {selectedTargetConfig?.extension.toUpperCase()}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
