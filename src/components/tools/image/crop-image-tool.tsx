"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Crop as CropIcon,
  Download,
  RotateCcw,
  RotateCw,
  FileImage,
  Sliders,
  CheckCircle2,
  ArrowRight,
  Info,
  Layers,
  Palette,
  Maximize2,
  Move,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  FileDropzone,
  ProcessingIndicator,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  CropFormat,
  CropRect,
  ASPECT_RATIOS,
  CropImageResult,
  cropImage,
  clampCropRect,
  calculateInitialCropRect,
  generateCroppedFilename,
  detectImageFormat,
  getImageMetadata,
  ImageMetadata,
} from "@/lib/image/crop-image";
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

const FORMAT_OPTIONS: { id: "original" | CropFormat; label: string; desc: string }[] = [
  { id: "original", label: "Keep Original", desc: "Preserve uploaded format" },
  { id: "image/jpeg", label: "JPG", desc: "High compression, no alpha" },
  { id: "image/png", label: "PNG", desc: "Lossless with transparency" },
  { id: "image/webp", label: "WebP", desc: "Efficient with alpha" },
];

const BACKGROUND_PRESETS = [
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
  { label: "Light Gray", value: "#f3f4f6" },
];

type DragHandle = "move" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export function CropImageTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceMetadata, setSourceMetadata] = useState<ImageMetadata | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string>("");

  // Crop & Transform Configuration
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, width: 100, height: 100 });
  const [selectedRatioId, setSelectedRatioId] = useState<string>("free");
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270

  // Output Format & Quality
  const [outputFormat, setOutputFormat] = useState<"original" | CropFormat>("original");
  const [quality, setQuality] = useState<number>(80);
  const [backgroundColor, setBackgroundColor] = useState<string>("#ffffff");

  // Result & Processing State
  const [result, setResult] = useState<CropImageResult | null>(null);
  const [resultPreviewUrl, setResultPreviewUrl] = useState<string>("");
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Container & Image measurement for responsive visual overlay
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [displayMetrics, setDisplayMetrics] = useState<{
    displayWidth: number;
    displayHeight: number;
    scale: number;
  }>({ displayWidth: 1, displayHeight: 1, scale: 1 });

  // Pointer drag state
  const dragRef = useRef<{
    isDragging: boolean;
    handle: DragHandle | null;
    startX: number;
    startY: number;
    initialRect: CropRect;
  }>({
    isDragging: false,
    handle: null,
    startX: 0,
    startY: 0,
    initialRect: { x: 0, y: 0, width: 100, height: 100 },
  });

  // Dedicated ObjectUrlManager
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

  // Handle image load to calculate scale factor
  const updateDisplayMetrics = useCallback(() => {
    if (!imageRef.current || !sourceMetadata) return;
    const imgEl = imageRef.current;
    const dispW = imgEl.clientWidth;
    const dispH = imgEl.clientHeight;

    const isSwapped = rotation === 90 || rotation === 270;
    const naturalW = isSwapped ? sourceMetadata.height : sourceMetadata.width;

    if (dispW > 0 && naturalW > 0) {
      const scale = dispW / naturalW;
      setDisplayMetrics({
        displayWidth: dispW,
        displayHeight: dispH,
        scale: scale > 0 ? scale : 1,
      });
    }
  }, [sourceMetadata, rotation]);

  // Window resize observer
  useEffect(() => {
    updateDisplayMetrics();
    window.addEventListener("resize", updateDisplayMetrics);
    return () => window.removeEventListener("resize", updateDisplayMetrics);
  }, [updateDisplayMetrics]);

  // Effective dimensions based on current rotation
  const isRotated90or270 = rotation === 90 || rotation === 270;
  const currentNaturalWidth = sourceMetadata
    ? isRotated90or270
      ? sourceMetadata.height
      : sourceMetadata.width
    : 1;
  const currentNaturalHeight = sourceMetadata
    ? isRotated90or270
      ? sourceMetadata.width
      : sourceMetadata.height
    : 1;

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
      setRotation(0);
      setSelectedRatioId("free");
      setOutputFormat("original");
      setQuality(80);
      setBackgroundColor("#ffffff");

      // Initial crop centered with 80% coverage
      const initRect = calculateInitialCropRect(meta.width, meta.height, null);
      setCropRect(initRect);

      setStatus("idle");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setSelectedFile(null);
      setSourceMetadata(null);
      setStatus("error");
    }
  };

  // Handle Aspect Ratio Change
  const handleRatioChange = (ratioId: string) => {
    setSelectedRatioId(ratioId);
    const found = ASPECT_RATIOS.find((r) => r.id === ratioId);
    const ratioVal = found ? found.ratio : null;

    const newRect = calculateInitialCropRect(
      currentNaturalWidth,
      currentNaturalHeight,
      ratioVal
    );
    setCropRect(newRect);
  };

  // Handle 90° Rotation
  const handleRotate = (direction: "left" | "right") => {
    const delta = direction === "right" ? 90 : -90;
    const newRot = ((rotation + delta) % 360 + 360) % 360;
    setRotation(newRot);

    // Swap bounds and re-center crop rect
    const nextWidth = isRotated90or270 ? sourceMetadata!.width : sourceMetadata!.height;
    const nextHeight = isRotated90or270 ? sourceMetadata!.height : sourceMetadata!.width;

    const currentRatioOpt = ASPECT_RATIOS.find((r) => r.id === selectedRatioId);
    const newRect = calculateInitialCropRect(nextWidth, nextHeight, currentRatioOpt?.ratio ?? null);
    setCropRect(newRect);
  };

  // Accessible precision controls
  const handleNumericCropChange = (field: keyof CropRect, value: number) => {
    if (isNaN(value)) return;
    const updated = { ...cropRect, [field]: value };
    const clamped = clampCropRect(updated, currentNaturalWidth, currentNaturalHeight);
    setCropRect(clamped);
  };

  const handleCenterCrop = () => {
    const currentRatioOpt = ASPECT_RATIOS.find((r) => r.id === selectedRatioId);
    const newRect = calculateInitialCropRect(
      currentNaturalWidth,
      currentNaturalHeight,
      currentRatioOpt?.ratio ?? null
    );
    setCropRect(newRect);
  };

  const handleMaximizeCrop = () => {
    setCropRect({
      x: 0,
      y: 0,
      width: currentNaturalWidth,
      height: currentNaturalHeight,
    });
    setSelectedRatioId("free");
  };

  // POINTER DRAG & RESIZE ENGINE
  const handlePointerDown = (e: React.PointerEvent, handle: DragHandle) => {
    e.preventDefault();
    e.stopPropagation();

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragRef.current = {
      isDragging: true,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initialRect: { ...cropRect },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging || !dragRef.current.handle) return;
    e.preventDefault();

    const { handle, startX, startY, initialRect } = dragRef.current;
    const scale = displayMetrics.scale > 0 ? displayMetrics.scale : 1;

    // Convert screen delta to natural image pixel delta
    const deltaX = (e.clientX - startX) / scale;
    const deltaY = (e.clientY - startY) / scale;

    const currentRatioOpt = ASPECT_RATIOS.find((r) => r.id === selectedRatioId);
    const targetRatio = currentRatioOpt?.ratio ?? null;

    let newX = initialRect.x;
    let newY = initialRect.y;
    let newW = initialRect.width;
    let newH = initialRect.height;

    if (handle === "move") {
      newX = initialRect.x + deltaX;
      newY = initialRect.y + deltaY;
    } else {
      // Handle corner and edge resizing
      if (handle.includes("e")) newW = initialRect.width + deltaX;
      if (handle.includes("s")) newH = initialRect.height + deltaY;
      if (handle.includes("w")) {
        newW = initialRect.width - deltaX;
        newX = initialRect.x + deltaX;
      }
      if (handle.includes("n")) {
        newH = initialRect.height - deltaY;
        newY = initialRect.y + deltaY;
      }

      // Maintain aspect ratio if fixed
      if (targetRatio && targetRatio > 0) {
        if (handle === "e" || handle === "w" || handle === "ne" || handle === "nw") {
          newH = newW / targetRatio;
          if (handle.includes("n")) newY = initialRect.y + (initialRect.height - newH);
        } else {
          newW = newH * targetRatio;
          if (handle.includes("w")) newX = initialRect.x + (initialRect.width - newW);
        }
      }
    }

    const clamped = clampCropRect(
      { x: newX, y: newY, width: newW, height: newH },
      currentNaturalWidth,
      currentNaturalHeight
    );

    setCropRect(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      dragRef.current.handle = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
  };

  // Execute Crop
  const handleCrop = async () => {
    if (!selectedFile || !sourceMetadata) return;

    setStatus("processing");
    setGeneralError(null);

    try {
      const res = await cropImage(selectedFile, {
        cropRect,
        rotation,
        outputFormat,
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

  // Download Cropped Result
  const handleDownload = () => {
    if (!result || !selectedFile) return;
    const filename = generateCroppedFilename(selectedFile.name, result.extension);
    downloadBlob(result.blob, filename);
  };

  // Reset Tool
  const handleReset = () => {
    clearPreviewUrls();
    setSelectedFile(null);
    setSourceMetadata(null);
    setResult(null);
    setGeneralError(null);
    setRotation(0);
    setSelectedRatioId("free");
    setOutputFormat("original");
    setQuality(80);
    setBackgroundColor("#ffffff");
    setStatus("idle");
  };

  const targetFormatResolved: CropFormat =
    !selectedFile || outputFormat === "original"
      ? selectedFile
        ? detectImageFormat(selectedFile)
        : "image/jpeg"
      : outputFormat;

  const isConvertingToJpeg = targetFormatResolved === "image/jpeg";
  const isQualitySupported = targetFormatResolved === "image/jpeg" || targetFormatResolved === "image/webp";

  // Visual overlay calculations (scaled to displayed image size)
  const scale = displayMetrics.scale > 0 ? displayMetrics.scale : 1;
  const overlayBox = {
    left: cropRect.x * scale,
    top: cropRect.y * scale,
    width: cropRect.width * scale,
    height: cropRect.height * scale,
  };

  return (
    <div className="w-full space-y-6">
      {/* Error Alert Display */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onRetry={selectedFile ? handleCrop : undefined}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* STATE 1: Empty / Idle - Dropzone */}
      {!selectedFile && (
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          validationOptions={DROPZONE_VALIDATION}
          title="Drop your image here to crop"
          subtitle="Supports JPG, PNG, and WebP up to 50MB"
          multiple={false}
          disabled={status === "validating"}
        />
      )}

      {/* STATE 2: Processing Indicator */}
      {status === "processing" && (
        <ProcessingIndicator
          statusText="Cropping image locally in your browser..."
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
                    Image Cropped Successfully!
                  </h3>
                  <p className="text-xs text-slate-500">
                    Processed locally in {Math.round(result.executionTimeMs)}ms • Cropped to {result.width} × {result.height} px
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  size="default"
                  onClick={handleDownload}
                  className="gap-2 shadow-sm font-semibold"
                  id="download-cropped-image-button"
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
                  Crop Another
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
                  <span>Full Dimensions:</span>
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

              {/* Cropped Stats Card */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Cropped Output
                  </span>
                  <Badge variant="clientSide" className="text-[11px]">
                    {result.extension.toUpperCase()}
                  </Badge>
                </div>
                <p
                  className="text-sm font-medium text-slate-800 truncate"
                  title={generateCroppedFilename(selectedFile.name, result.extension)}
                >
                  {generateCroppedFilename(selectedFile.name, result.extension)}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-blue-100">
                  <span>Cropped Dimensions:</span>
                  <span className="font-mono font-bold text-blue-900">
                    {result.width} × {result.height} px
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Output File Size:</span>
                  <span className="font-mono font-bold text-blue-900">
                    {formatBytes(result.sizeBytes)}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Cropped Result Box */}
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">Cropped Result Preview</span>
                <span>Aspect Ratio: {(result.width / result.height).toFixed(2)}:1</span>
              </div>
              <div className="relative flex items-center justify-center p-4 rounded-xl border border-slate-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 overflow-hidden min-h-[260px] max-h-[460px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultPreviewUrl}
                  alt="Cropped output preview"
                  className="max-h-[420px] max-w-full object-contain rounded-lg shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: File Loaded - Interactive Cropper Workspace */}
      {selectedFile && sourceMetadata && status !== "success" && status !== "processing" && (
        <div className="space-y-6">
          {/* File Header Bar & Transform Shortcuts */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-2xs text-blue-600">
                <FileImage className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-md">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-500">
                  {currentNaturalWidth} × {currentNaturalHeight} px {rotation !== 0 ? `(${rotation}° rotated)` : ""} • {formatBytes(selectedFile.size)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Rotation Shortcuts */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRotate("left")}
                className="text-xs text-slate-700 h-8 gap-1.5"
                title="Rotate 90° Left"
                aria-label="Rotate 90 degrees counter-clockwise"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                90° Left
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRotate("right")}
                className="text-xs text-slate-700 h-8 gap-1.5"
                title="Rotate 90° Right"
                aria-label="Rotate 90 degrees clockwise"
              >
                <RotateCw className="h-3.5 w-3.5" />
                90° Right
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs text-slate-600 h-8 gap-1.5"
              >
                Change Image
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Visual Crop Workspace */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Interactive Crop Area
                </span>
                <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                  {cropRect.width} × {cropRect.height} px
                </span>
              </div>

              {/* Visual Crop Stage Container */}
              <div
                ref={imageContainerRef}
                className="relative select-none flex items-center justify-center p-2 rounded-2xl border border-slate-300 bg-slate-900/95 overflow-hidden min-h-[320px] max-h-[520px]"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                {/* Source Image Display */}
                <div className="relative inline-block overflow-hidden max-h-[480px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imageRef}
                    src={sourcePreviewUrl}
                    alt="Crop preview target"
                    onLoad={updateDisplayMetrics}
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transformOrigin: "center center",
                    }}
                    className="max-h-[480px] max-w-full object-contain block transition-transform duration-200 pointer-events-none"
                  />

                  {/* Dark Masking Overlays (Top, Bottom, Left, Right) */}
                  <div
                    className="absolute top-0 left-0 right-0 bg-slate-950/65 pointer-events-none"
                    style={{ height: `${Math.max(0, overlayBox.top)}px` }}
                  />
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-slate-950/65 pointer-events-none"
                    style={{ top: `${Math.max(0, overlayBox.top + overlayBox.height)}px` }}
                  />
                  <div
                    className="absolute left-0 bg-slate-950/65 pointer-events-none"
                    style={{
                      top: `${Math.max(0, overlayBox.top)}px`,
                      height: `${Math.max(0, overlayBox.height)}px`,
                      width: `${Math.max(0, overlayBox.left)}px`,
                    }}
                  />
                  <div
                    className="absolute right-0 bg-slate-950/65 pointer-events-none"
                    style={{
                      top: `${Math.max(0, overlayBox.top)}px`,
                      height: `${Math.max(0, overlayBox.height)}px`,
                      left: `${Math.max(0, overlayBox.left + overlayBox.width)}px`,
                    }}
                  />

                  {/* Interactive Crop Box Overlay */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, "move")}
                    className="absolute border-2 border-blue-400 bg-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.7)] cursor-move touch-none"
                    style={{
                      left: `${overlayBox.left}px`,
                      top: `${overlayBox.top}px`,
                      width: `${overlayBox.width}px`,
                      height: `${overlayBox.height}px`,
                    }}
                  >
                    {/* Rule of Thirds Grid Lines */}
                    <div className="absolute inset-0 pointer-events-none opacity-40">
                      <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/80 border-dashed" />
                      <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/80 border-dashed" />
                      <div className="absolute top-1/3 left-0 right-0 border-t border-white/80 border-dashed" />
                      <div className="absolute top-2/3 left-0 right-0 border-t border-white/80 border-dashed" />
                    </div>

                    {/* Resize Handles (Corners & Edges) */}
                    {/* NW */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "nw")}
                      className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 rounded-xs bg-white border-2 border-blue-600 shadow-xs cursor-nwse-resize"
                    />
                    {/* NE */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "ne")}
                      className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-xs bg-white border-2 border-blue-600 shadow-xs cursor-nesw-resize"
                    />
                    {/* SE */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "se")}
                      className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-xs bg-white border-2 border-blue-600 shadow-xs cursor-nwse-resize"
                    />
                    {/* SW */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "sw")}
                      className="absolute -bottom-1.5 -left-1.5 h-3.5 w-3.5 rounded-xs bg-white border-2 border-blue-600 shadow-xs cursor-nesw-resize"
                    />

                    {/* Edge Handles */}
                    {/* N */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "n")}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-6 rounded-xs bg-white border border-blue-600 shadow-xs cursor-ns-resize"
                    />
                    {/* S */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "s")}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-2.5 w-6 rounded-xs bg-white border border-blue-600 shadow-xs cursor-ns-resize"
                    />
                    {/* W */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "w")}
                      className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-6 rounded-xs bg-white border border-blue-600 shadow-xs cursor-ew-resize"
                    />
                    {/* E */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "e")}
                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-6 rounded-xs bg-white border border-blue-600 shadow-xs cursor-ew-resize"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons for Crop Box */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCenterCrop}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Move className="h-3.5 w-3.5" />
                    Center Selection
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleMaximizeCrop}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Fit to Image
                  </Button>
                </div>
                <span className="text-slate-500 text-[11px]">
                  Drag the box or handles to reframe
                </span>
              </div>
            </div>

            {/* Right Column: Aspect Ratio, Precision Inputs & Format Settings */}
            <div className="lg:col-span-5 space-y-5">
              {/* Aspect Ratio Presets Card */}
              <Card className="p-4 space-y-3 border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CropIcon className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      Aspect Ratio
                    </h4>
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                    {selectedRatioId}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {ASPECT_RATIOS.map((r) => {
                    const isSelected = selectedRatioId === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleRatioChange(r.id)}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer",
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/20 font-bold"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 text-xs font-medium"
                        )}
                      >
                        <span className="text-xs">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Accessible Numeric Precision Controls */}
              <Card className="p-4 space-y-3 border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Precise Dimensions & Position (px)
                </h4>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label htmlFor="crop-w" className="block text-slate-500 font-medium mb-1">
                      Width (px)
                    </label>
                    <Input
                      id="crop-w"
                      type="number"
                      min={10}
                      max={currentNaturalWidth}
                      value={cropRect.width}
                      onChange={(e) => handleNumericCropChange("width", parseInt(e.target.value, 10))}
                      className="font-mono text-sm h-9"
                    />
                  </div>
                  <div>
                    <label htmlFor="crop-h" className="block text-slate-500 font-medium mb-1">
                      Height (px)
                    </label>
                    <Input
                      id="crop-h"
                      type="number"
                      min={10}
                      max={currentNaturalHeight}
                      value={cropRect.height}
                      onChange={(e) => handleNumericCropChange("height", parseInt(e.target.value, 10))}
                      className="font-mono text-sm h-9"
                    />
                  </div>
                  <div>
                    <label htmlFor="crop-x" className="block text-slate-500 font-medium mb-1">
                      Position X (px)
                    </label>
                    <Input
                      id="crop-x"
                      type="number"
                      min={0}
                      max={currentNaturalWidth - cropRect.width}
                      value={cropRect.x}
                      onChange={(e) => handleNumericCropChange("x", parseInt(e.target.value, 10))}
                      className="font-mono text-sm h-9"
                    />
                  </div>
                  <div>
                    <label htmlFor="crop-y" className="block text-slate-500 font-medium mb-1">
                      Position Y (px)
                    </label>
                    <Input
                      id="crop-y"
                      type="number"
                      min={0}
                      max={currentNaturalHeight - cropRect.height}
                      value={cropRect.y}
                      onChange={(e) => handleNumericCropChange("y", parseInt(e.target.value, 10))}
                      className="font-mono text-sm h-9"
                    />
                  </div>
                </div>
              </Card>

              {/* Output Format & Quality Card */}
              <Card className="p-4 space-y-4 border-slate-200">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Export Format & Quality
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {FORMAT_OPTIONS.map((f) => {
                    const isSelected = outputFormat === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setOutputFormat(f.id)}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer",
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/20 font-bold"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 font-medium"
                        )}
                      >
                        <span className="text-xs font-bold">{f.label}</span>
                        <span className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                          {f.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Transparency Warning & Background Color for JPEG */}
                {isConvertingToJpeg && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50/90 rounded-xl border border-amber-200/80 text-xs text-amber-900">
                      <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        JPG format lacks an alpha channel. Transparent areas will be rendered with your chosen background color.
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="crop-bg-color" className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5 text-slate-500" />
                        Background Color
                      </label>
                      <span className="font-mono text-[11px] text-slate-500 uppercase">
                        {backgroundColor}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="crop-bg-color"
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="h-8 w-10 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                        aria-label="Background color for JPEG"
                      />
                      {BACKGROUND_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setBackgroundColor(p.value)}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors",
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
                )}

                {/* Quality Slider for Lossy Formats */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-slate-500" />
                      <label htmlFor="crop-quality-slider" className="font-bold text-slate-700">
                        Quality
                      </label>
                    </div>
                    {isQualitySupported ? (
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                        {quality}%
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        Lossless (N/A)
                      </span>
                    )}
                  </div>

                  {isQualitySupported ? (
                    <input
                      id="crop-quality-slider"
                      type="range"
                      min={10}
                      max={100}
                      step={1}
                      value={quality}
                      onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                      className="w-full accent-blue-600 cursor-pointer"
                      aria-label="Image encoding quality slider"
                    />
                  ) : (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                      PNG uses lossless Deflate compression. Quality slider is not applicable.
                    </p>
                  )}
                </div>
              </Card>

              {/* Action Button */}
              <Button
                type="button"
                size="lg"
                onClick={handleCrop}
                className="w-full text-base font-bold shadow-sm gap-2 h-12"
                id="crop-image-button"
              >
                <CropIcon className="h-5 w-5" />
                Crop Image ({cropRect.width} × {cropRect.height} px)
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
