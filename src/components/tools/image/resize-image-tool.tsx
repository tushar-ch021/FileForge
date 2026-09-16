"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Maximize2,
  Lock,
  Unlock,
  Download,
  RotateCcw,
  Sparkles,
  AlertCircle,
  FileImage,
  Layers,
  Sliders,
  CheckCircle2,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  FileDropzone,
  ProcessingIndicator,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  SupportedImageFormat,
  SUPPORTED_IMAGE_FORMATS,
  ImageMetadata,
  ResizeImageResult,
  getImageMetadata,
  resizeImage,
  validateDimensions,
  calculateLockedDimension,
  generateResizedFilename,
  MAX_SAFE_DIMENSION,
} from "@/lib/image/resize-image";
import { formatBytes, calculateSavings } from "@/lib/workspace/file-validator";
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

const SCALE_PRESETS = [
  { label: "25%", factor: 0.25 },
  { label: "50%", factor: 0.5 },
  { label: "75%", factor: 0.75 },
  { label: "100%", factor: 1.0 },
  { label: "150%", factor: 1.5 },
  { label: "200%", factor: 2.0 },
];

const COMMON_DIMENSION_PRESETS = [
  { label: "1080p FHD", width: 1920, height: 1080 },
  { label: "720p HD", width: 1280, height: 720 },
  { label: "Square (1:1)", width: 1080, height: 1080 },
  { label: "Web Social", width: 1200, height: 630 },
];

export function ResizeImageTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceMetadata, setSourceMetadata] = useState<ImageMetadata | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string>("");

  // Resize Configuration State
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [outputFormat, setOutputFormat] = useState<SupportedImageFormat>("image/png");
  const [quality, setQuality] = useState<number>(85);
  const [dimensionError, setDimensionError] = useState<string | null>(null);

  // Result & Processing State
  const [result, setResult] = useState<ResizeImageResult | null>(null);
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
    setDimensionError(null);
    setStatus("validating");

    try {
      const meta = await getImageMetadata(file);
      const previewUrl = urlManager.create(file) || "";

      setSelectedFile(file);
      setSourceMetadata(meta);
      setSourcePreviewUrl(previewUrl);

      // Initialize dimensions with source
      setWidth(meta.width.toString());
      setHeight(meta.height.toString());
      setAspectRatio(meta.aspectRatio);
      setIsLocked(true);
      setOutputFormat(meta.format);
      setStatus("idle");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setSelectedFile(null);
      setSourceMetadata(null);
      setStatus("error");
    }
  };

  // Validate dimensions on value change
  const checkDimensions = useCallback((w: number, h: number): boolean => {
    const check = validateDimensions(w, h);
    if (!check.isValid) {
      setDimensionError(check.error || "Invalid dimensions.");
      return false;
    }
    setDimensionError(null);
    return true;
  }, []);

  // Handle width change
  const handleWidthChange = (valStr: string) => {
    setWidth(valStr);
    const num = parseInt(valStr, 10);

    if (isNaN(num) || num <= 0) {
      setDimensionError("Width must be a positive integer.");
      return;
    }

    if (isLocked && aspectRatio > 0) {
      const { height: newH } = calculateLockedDimension("width", num, aspectRatio);
      setHeight(newH.toString());
      checkDimensions(num, newH);
    } else {
      const currentH = parseInt(height, 10);
      if (!isNaN(currentH)) {
        checkDimensions(num, currentH);
      }
    }
  };

  // Handle height change
  const handleHeightChange = (valStr: string) => {
    setHeight(valStr);
    const num = parseInt(valStr, 10);

    if (isNaN(num) || num <= 0) {
      setDimensionError("Height must be a positive integer.");
      return;
    }

    if (isLocked && aspectRatio > 0) {
      const { width: newW } = calculateLockedDimension("height", num, aspectRatio);
      setWidth(newW.toString());
      checkDimensions(newW, num);
    } else {
      const currentW = parseInt(width, 10);
      if (!isNaN(currentW)) {
        checkDimensions(currentW, num);
      }
    }
  };

  // Handle scale presets (25%, 50%, etc.)
  const handleApplyScalePreset = (factor: number) => {
    if (!sourceMetadata) return;
    const newW = Math.max(1, Math.round(sourceMetadata.width * factor));
    const newH = Math.max(1, Math.round(sourceMetadata.height * factor));
    setWidth(newW.toString());
    setHeight(newH.toString());
    checkDimensions(newW, newH);
  };

  // Handle preset dimensions (1080p, 720p, etc.)
  const handleApplyDimensionPreset = (w: number, h: number) => {
    setWidth(w.toString());
    setHeight(h.toString());
    setAspectRatio(w / h);
    checkDimensions(w, h);
  };

  // Toggle Aspect Ratio Lock
  const handleToggleLock = () => {
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);

    // If re-locking, update current aspect ratio from current width and height
    if (nextLocked) {
      const w = parseInt(width, 10);
      const h = parseInt(height, 10);
      if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
        setAspectRatio(w / h);
      }
    }
  };

  // Execute Resize
  const handleResize = async () => {
    if (!selectedFile || !sourceMetadata) return;

    const targetW = parseInt(width, 10);
    const targetH = parseInt(height, 10);

    if (!checkDimensions(targetW, targetH)) return;

    setStatus("processing");
    setGeneralError(null);

    try {
      const res = await resizeImage(selectedFile, {
        width: targetW,
        height: targetH,
        format: outputFormat,
        quality,
        backgroundColor: "#ffffff",
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

  // Download Resized Image
  const handleDownload = () => {
    if (!result || !selectedFile) return;
    const filename = generateResizedFilename(selectedFile.name, result.extension);
    downloadBlob(result.blob, filename);
  };

  // Reset Tool
  const handleReset = () => {
    clearPreviewUrls();
    setSelectedFile(null);
    setSourceMetadata(null);
    setWidth("");
    setHeight("");
    setIsLocked(true);
    setDimensionError(null);
    setResult(null);
    setGeneralError(null);
    setStatus("idle");
  };

  const selectedFormatConfig = SUPPORTED_IMAGE_FORMATS.find(
    (f) => f.format === outputFormat
  );

  const numWidth = parseInt(width, 10);
  const numHeight = parseInt(height, 10);
  const canResize =
    !dimensionError &&
    !isNaN(numWidth) &&
    !isNaN(numHeight) &&
    numWidth > 0 &&
    numHeight > 0 &&
    status !== "processing";

  return (
    <div className="w-full space-y-6">
      {/* Error Alert Display */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onRetry={selectedFile ? handleResize : undefined}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* STATE 1: Empty / Idle - Dropzone */}
      {!selectedFile && (
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          validationOptions={DROPZONE_VALIDATION}
          title="Drop your image here"
          subtitle="Supports JPG, PNG, and WebP up to 50MB"
          multiple={false}
          disabled={status === "validating"}
        />
      )}

      {/* STATE 2: Processing Indicator */}
      {status === "processing" && (
        <ProcessingIndicator
          statusText="Resizing image in your browser..."
        />
      )}

      {/* STATE 3: Success View with Comparison & Download */}
      {status === "success" && result && selectedFile && sourceMetadata && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            {/* Success Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-2xs">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Image Resized Successfully!
                  </h3>
                  <p className="text-xs text-slate-500">
                    Processed locally in {Math.round(result.executionTimeMs)}ms
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  size="default"
                  onClick={handleDownload}
                  className="gap-2 shadow-sm font-semibold"
                  id="download-resized-image-button"
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
                  Resize Another
                </Button>
              </div>
            </div>

            {/* Comparison Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
              {/* Original Stats Card */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Original File
                  </span>
                  <Badge variant="secondary" className="text-[11px]">
                    {sourceMetadata.format.replace("image/", "").toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-slate-800 truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                  <span>Dimensions:</span>
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

              {/* Resized Stats Card */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Resized Output
                  </span>
                  <Badge variant="clientSide" className="text-[11px]">
                    {result.extension.toUpperCase()}
                  </Badge>
                </div>
                <p
                  className="text-sm font-medium text-slate-800 truncate"
                  title={generateResizedFilename(selectedFile.name, result.extension)}
                >
                  {generateResizedFilename(selectedFile.name, result.extension)}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-blue-100">
                  <span>Dimensions:</span>
                  <span className="font-mono font-semibold text-blue-900">
                    {result.width} × {result.height} px
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>New File Size:</span>
                  <span className="font-mono font-semibold text-blue-900">
                    {formatBytes(result.sizeBytes)}
                  </span>
                </div>
              </div>
            </div>

            {/* Savings or Dimension Change Summary */}
            {(() => {
              const savings = calculateSavings(result.originalSizeBytes, result.sizeBytes);
              const pixelRatio = Math.round(
                ((result.width * result.height) /
                  (sourceMetadata.width * sourceMetadata.height)) *
                  100
              );

              return (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <span>
                      Pixel density scaled to <strong>{pixelRatio}%</strong> of original resolution.
                    </span>
                  </div>
                  {savings.isSmaller ? (
                    <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      File reduced by {savings.percentageSaved}% ({formatBytes(savings.bytesSaved)} saved)
                    </span>
                  ) : (
                    <span className="font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                      File size: {formatBytes(result.sizeBytes)}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Resized Image Preview Box */}
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">Visual Result Preview</span>
                <span>Aspect Ratio: {(result.width / result.height).toFixed(2)}:1</span>
              </div>
              <div className="relative flex items-center justify-center p-4 rounded-xl border border-slate-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 overflow-hidden min-h-[260px] max-h-[460px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultPreviewUrl}
                  alt="Resized preview"
                  className="max-h-[420px] max-w-full object-contain rounded-lg shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: File Loaded - Dimension & Format Settings */}
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
                  Original: {sourceMetadata.width} × {sourceMetadata.height} px • {formatBytes(selectedFile.size)}
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
                Image Preview
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
                <span>Original Ratio: {sourceMetadata.aspectRatio.toFixed(2)}:1</span>
                <span>Format: {sourceMetadata.format.replace("image/", "").toUpperCase()}</span>
              </div>
            </div>

            {/* Right Column: Resize Controls */}
            <div className="lg:col-span-7 space-y-6">
              {/* Dimension Settings Card */}
              <Card className="p-5 space-y-5 border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Maximize2 className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      Target Dimensions
                    </h4>
                  </div>

                  <Button
                    type="button"
                    variant={isLocked ? "accent" : "outline"}
                    size="sm"
                    onClick={handleToggleLock}
                    className="gap-1.5 h-8 text-xs font-semibold"
                    aria-label={isLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                    aria-pressed={isLocked}
                  >
                    {isLocked ? (
                      <>
                        <Lock className="h-3.5 w-3.5 text-blue-600" />
                        <span>Ratio Locked</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="h-3.5 w-3.5 text-slate-500" />
                        <span>Ratio Unlocked</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Width & Height Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Width Input */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="target-width"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                    >
                      Width (px)
                    </label>
                    <Input
                      id="target-width"
                      type="number"
                      min={1}
                      max={MAX_SAFE_DIMENSION}
                      value={width}
                      onChange={(e) => handleWidthChange(e.target.value)}
                      placeholder="e.g. 1920"
                      className="font-mono text-base font-semibold"
                    />
                  </div>

                  {/* Height Input */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="target-height"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                    >
                      Height (px)
                    </label>
                    <Input
                      id="target-height"
                      type="number"
                      min={1}
                      max={MAX_SAFE_DIMENSION}
                      value={height}
                      onChange={(e) => handleHeightChange(e.target.value)}
                      placeholder="e.g. 1080"
                      className="font-mono text-base font-semibold"
                    />
                  </div>
                </div>

                {/* Inline Dimension Error */}
                {dimensionError && (
                  <div className="flex items-center gap-2 p-2.5 text-xs text-rose-700 bg-rose-50 rounded-xl border border-rose-200">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{dimensionError}</span>
                  </div>
                )}

                {/* Scale Percentage Presets */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">
                    Quick Scale %
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {SCALE_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleApplyScalePreset(preset.factor)}
                        className="h-8 text-xs font-mono font-medium hover:border-blue-300 hover:text-blue-600"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Dimension Presets */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">
                    Standard Presets
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {COMMON_DIMENSION_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyDimensionPreset(preset.width, preset.height)}
                        className="h-auto py-1.5 flex flex-col items-center justify-center text-[11px] text-slate-700 hover:border-blue-300"
                      >
                        <span className="font-semibold">{preset.label}</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {preset.width}×{preset.height}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Format & Quality Settings Card */}
              <Card className="p-5 space-y-5 border-slate-200">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Output Format & Quality
                  </h4>
                </div>

                {/* Format Selection Buttons */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Format
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {SUPPORTED_IMAGE_FORMATS.map((f) => {
                      const isSelected = outputFormat === f.format;
                      return (
                        <button
                          key={f.format}
                          type="button"
                          onClick={() => setOutputFormat(f.format)}
                          className={cn(
                            "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                            isSelected
                              ? "border-blue-600 bg-blue-50/60 text-blue-900 ring-2 ring-blue-600/20 font-bold"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 font-medium"
                          )}
                        >
                          <span className="text-sm">{f.label}</span>
                          <span className="text-[10px] text-slate-500">
                            {f.supportsTransparency ? "Transparency" : "No Alpha"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Transparency Notice for JPEG */}
                {outputFormat === "image/jpeg" && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 text-xs text-amber-900">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      JPG format does not support transparency. Transparent areas will be filled with a clean white background. To preserve transparency, choose <strong>PNG</strong> or <strong>WebP</strong>.
                    </span>
                  </div>
                )}

                {/* Quality Slider for Lossy Formats */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-slate-500" />
                      <label
                        htmlFor="image-quality-slider"
                        className="text-xs font-bold text-slate-700 uppercase tracking-wider"
                      >
                        Quality
                      </label>
                    </div>
                    {selectedFormatConfig?.supportsQuality ? (
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                        {quality}%
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">
                        Lossless (N/A)
                      </span>
                    )}
                  </div>

                  {selectedFormatConfig?.supportsQuality ? (
                    <div className="space-y-2">
                      <input
                        id="image-quality-slider"
                        type="range"
                        min={10}
                        max={100}
                        step={1}
                        value={quality}
                        onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                        className="w-full accent-blue-600 cursor-pointer"
                        aria-label="Compression quality slider"
                      />
                      <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                        <span>10% (Smaller size)</span>
                        <span>85% (Recommended)</span>
                        <span>100% (Best clarity)</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                      PNG format produces pixel-perfect lossless graphics. Quality compression slider is not applicable to PNG.
                    </p>
                  )}
                </div>
              </Card>

              {/* Action Button */}
              <Button
                type="button"
                size="lg"
                onClick={handleResize}
                disabled={!canResize}
                className="w-full text-base font-bold shadow-sm gap-2 h-12"
                id="resize-image-button"
              >
                <Maximize2 className="h-5 w-5" />
                Resize Image
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
