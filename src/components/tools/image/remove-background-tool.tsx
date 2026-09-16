"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Scissors,
  RotateCcw,
  Zap,
  Cpu,
  FileImage,
  Layers,
  Palette,
  CheckCircle2,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  FileDropzone,
  ProcessingIndicator,
  ResultView,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  removeImageBackground,
  applyBackgroundColor,
  generateBackgroundRemovedFilename,
  checkWebGpuSupport,
  BackgroundRemovalModel,
  BackgroundRemovalProgress,
  RemoveBackgroundResult,
} from "@/lib/image/remove-background";
import { getImageMetadata, ImageMetadata } from "@/lib/image/resize-image";
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

const SOLID_PRESETS = [
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
  { label: "Soft Gray", value: "#f3f4f6" },
  { label: "Slate", value: "#1e293b" },
  { label: "Studio Blue", value: "#2563eb" },
  { label: "Emerald", value: "#059669" },
  { label: "Blush", value: "#f43f5e" },
];

export function RemoveBackgroundTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceMetadata, setSourceMetadata] = useState<ImageMetadata | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string>("");

  // Hardware capability state
  const [isGpuAvailable, setIsGpuAvailable] = useState<boolean | null>(null);

  // Model & Processing Settings
  const [selectedModel, setSelectedModel] = useState<BackgroundRemovalModel>("medium");
  const [progressState, setProgressState] = useState<BackgroundRemovalProgress>({
    stage: "initializing",
    message: "Initializing background removal engine...",
  });

  // Results State
  const [rawResult, setRawResult] = useState<RemoveBackgroundResult | null>(null);
  const [transparentPreviewUrl, setTransparentPreviewUrl] = useState<string>("");

  // Background Customization State
  const [backgroundMode, setBackgroundMode] = useState<"transparent" | "solid">("transparent");
  const [solidColor, setSolidColor] = useState<string>("#ffffff");

  const [generalError, setGeneralError] = useState<string | null>(null);

  // Object URL lifecycle manager
  const [urlManager] = useState(() => new ObjectUrlManager());

  // Check WebGPU capability on mount
  useEffect(() => {
    let mounted = true;
    checkWebGpuSupport().then((hasGpu) => {
      if (mounted) {
        setIsGpuAvailable(hasGpu);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      urlManager.revokeAll();
    };
  }, [urlManager]);

  // Clean active URLs
  const clearPreviewUrls = useCallback(() => {
    if (sourcePreviewUrl) {
      urlManager.revoke(sourcePreviewUrl);
      setSourcePreviewUrl("");
    }
    if (transparentPreviewUrl) {
      urlManager.revoke(transparentPreviewUrl);
      setTransparentPreviewUrl("");
    }
  }, [sourcePreviewUrl, transparentPreviewUrl, urlManager]);

  // File selection handler
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (!files || files.length === 0) return;
      const file = files[0];

      setGeneralError(null);
      clearPreviewUrls();
      setRawResult(null);
      setBackgroundMode("transparent");

      try {
        const metadata = await getImageMetadata(file);
        const previewUrl = urlManager.create(file);

        setSelectedFile(file);
        setSourceMetadata(metadata);
        setSourcePreviewUrl(previewUrl);
        setStatus("idle");
      } catch (err) {
        setGeneralError(getErrorMessage(err));
        setSelectedFile(null);
        setSourceMetadata(null);
      }
    },
    [clearPreviewUrls, urlManager]
  );

  // Execute Background Removal
  const handleProcess = async () => {
    if (!selectedFile) return;

    setStatus("processing");
    setGeneralError(null);
    setProgressState({
      stage: "initializing",
      message: "Starting client-side background removal...",
    });

    try {
      const result = await removeImageBackground(selectedFile, {
        model: selectedModel,
        device: "auto",
        onProgress: (prog) => {
          setProgressState(prog);
        },
      });

      const transUrl = urlManager.create(result.blob);
      setRawResult(result);
      setTransparentPreviewUrl(transUrl);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setGeneralError(getErrorMessage(err));
    }
  };

  // Download handler - composites solid color on-demand if solid mode is selected
  const handleDownload = async () => {
    if (!selectedFile || !rawResult) return;

    const isSolid = backgroundMode === "solid";

    try {
      let downloadBlobData = rawResult.blob;
      if (isSolid) {
        downloadBlobData = await applyBackgroundColor(rawResult.blob, solidColor);
      }
      const filename = generateBackgroundRemovedFilename(selectedFile.name, isSolid);
      downloadBlob(downloadBlobData, filename);
    } catch (err) {
      setGeneralError(`Error generating download file: ${getErrorMessage(err)}`);
    }
  };

  // Reset tool handler
  const handleReset = () => {
    clearPreviewUrls();
    setSelectedFile(null);
    setSourceMetadata(null);
    setRawResult(null);
    setBackgroundMode("transparent");
    setStatus("idle");
    setGeneralError(null);
  };

  return (
    <div className="space-y-6">
      {/* Privacy Guarantee & Hardware Capability Callout */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/20 px-4 py-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>
            <strong>100% Client-Side AI:</strong> Your photos are processed privately in your browser
            and are never uploaded to any server.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isGpuAvailable === true ? (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <Zap className="h-3 w-3 fill-emerald-500" />
              WebGPU Accelerated
            </Badge>
          ) : isGpuAvailable === false ? (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            >
              <Cpu className="h-3 w-3" />
              WebAssembly CPU Engine
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Error Alert */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* Step 1: Upload Dropzone */}
      {!selectedFile && (
        <div className="space-y-4">
          <FileDropzone
            validationOptions={DROPZONE_VALIDATION}
            onFilesSelected={handleFilesSelected}
            title="Drop photo to remove background"
            subtitle="Supports JPG, PNG, and WebP files up to 50MB"
          />

          {/* First-Time Notice Card */}
          <Card className="flex items-start gap-3 border-dashed border-border/70 bg-card/40 p-4 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">First-Time Model Download</p>
              <p className="mt-0.5 leading-relaxed">
                The first time you use this tool, your browser downloads the local neural network
                model (~40MB to ~80MB) and stores it in your browser cache. Subsequent uses will run
                much faster and work entirely offline.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Step 2: Configure & Initiate Processing */}
      {selectedFile && status !== "success" && (
        <div className="space-y-6">
          {/* Source Image Summary Card */}
          <Card className="p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary/50">
                  {sourcePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sourcePreviewUrl}
                      alt="Source preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FileImage className="h-7 w-7 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{selectedFile.name}</h3>
                    <Badge variant="outline" className="uppercase text-[10px]">
                      {sourceMetadata?.format || "IMAGE"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sourceMetadata?.width} × {sourceMetadata?.height} px •{" "}
                    {formatBytes(selectedFile.size)}
                  </p>
                </div>
              </div>

              {status !== "processing" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="self-start text-xs text-muted-foreground sm:self-auto"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Choose Different Image
                </Button>
              )}
            </div>
          </Card>

          {/* Model Selection & Quality Settings (Only shown before processing) */}
          {status !== "processing" && (
            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground">
                  AI Segmentation Model
                </label>
                <span className="text-xs text-muted-foreground">
                  Stored in local browser cache
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSelectedModel("medium")}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-lg border p-3.5 text-left transition-all",
                    selectedModel === "medium"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/60 hover:border-border hover:bg-secondary/30"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-medium text-foreground text-sm">
                      Balanced (Recommended)
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      ~80 MB
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    High precision on fine hair, transparent fabrics, and complex boundaries.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedModel("small")}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-lg border p-3.5 text-left transition-all",
                    selectedModel === "small"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/60 hover:border-border hover:bg-secondary/30"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-medium text-foreground text-sm">Fast / Mobile</span>
                    <Badge variant="outline" className="text-[10px]">
                      ~40 MB
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quantized 8-bit model. Faster download and smaller memory consumption.
                  </p>
                </button>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  size="lg"
                  onClick={handleProcess}
                  className="w-full gap-2 text-sm font-medium sm:w-auto"
                >
                  <Scissors className="h-4 w-4" />
                  Remove Background
                </Button>
              </div>
            </Card>
          )}

          {/* Processing Indicator with Honest Progress */}
          {status === "processing" && (
            <Card className="space-y-4 p-6 text-center">
              <ProcessingIndicator
                statusText={progressState.message}
                progress={progressState.percentage}
              />
              {progressState.details && (
                <p className="text-xs text-muted-foreground">{progressState.details}</p>
              )}
              <p className="text-xs text-muted-foreground/80 italic">
                All computation runs locally on your machine. Please keep this tab open.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Step 3: Success & Results View */}
      {status === "success" && rawResult && (
        <div className="space-y-6">
          {/* Customization Bar: Background Mode & Color Picker */}
          <Card className="space-y-4 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">Background Options</h3>
              </div>

              {/* Verified True Alpha Transparency Badge */}
              {rawResult.hasTransparency && backgroundMode === "transparent" && (
                <Badge
                  variant="outline"
                  className="gap-1 self-start border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 sm:self-auto"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Verified Alpha Channel (Transparent PNG)
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-border bg-secondary/40 p-1">
                <button
                  type="button"
                  onClick={() => setBackgroundMode("transparent")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                    backgroundMode === "transparent"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Transparent (Default)
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundMode("solid")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                    backgroundMode === "solid"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Palette className="h-3.5 w-3.5" />
                  Solid Color
                </button>
              </div>

              {/* Solid Color Presets & Custom Picker */}
              {backgroundMode === "solid" && (
                <div className="flex flex-wrap items-center gap-2">
                  {SOLID_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setSolidColor(preset.value)}
                      title={preset.label}
                      className={cn(
                        "h-7 w-7 rounded-full border transition-transform hover:scale-110",
                        solidColor.toLowerCase() === preset.value.toLowerCase()
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : "border-border/80"
                      )}
                      style={{ backgroundColor: preset.value }}
                    />
                  ))}

                  {/* Custom Hex Picker Input */}
                  <div className="flex items-center gap-1.5 pl-1">
                    <input
                      type="color"
                      value={solidColor}
                      onChange={(e) => setSolidColor(e.target.value)}
                      className="h-7 w-7 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                      title="Choose custom background color"
                      aria-label="Custom background color"
                    />
                    <span className="font-mono text-xs uppercase text-muted-foreground">
                      {solidColor}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Side-by-Side Visual Comparison */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Original Card */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/50 bg-secondary/30 px-4 py-2.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Original Image
                </span>
                <span className="text-xs text-muted-foreground">
                  {sourceMetadata?.width} × {sourceMetadata?.height} px •{" "}
                  {selectedFile ? formatBytes(selectedFile.size) : ""}
                </span>
              </div>
              <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-secondary/20 p-4">
                {sourcePreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sourcePreviewUrl}
                    alt="Original photo"
                    className="max-h-full max-w-full rounded object-contain shadow-xs"
                  />
                )}
              </div>
            </Card>

            {/* Cutout Result Card with Checkerboard Pattern */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/50 bg-secondary/30 px-4 py-2.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {backgroundMode === "solid" ? "Composited Result" : "Transparent Cutout"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {rawResult.width} × {rawResult.height} px • {formatBytes(rawResult.size)}
                </span>
              </div>
              <div
                className={cn(
                  "relative flex aspect-square w-full items-center justify-center overflow-hidden p-4 transition-colors",
                  backgroundMode === "transparent"
                    ? "bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[size:16px_16px] dark:bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)]"
                    : ""
                )}
                style={backgroundMode === "solid" ? { backgroundColor: solidColor } : {}}
              >
                {transparentPreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={transparentPreviewUrl}
                    alt="Background removed cutout"
                    className="max-h-full max-w-full rounded object-contain drop-shadow-md"
                  />
                )}
              </div>
            </Card>
          </div>

          {/* Results Action Bar */}
          <ResultView
            filename={
              selectedFile
                ? generateBackgroundRemovedFilename(selectedFile.name, backgroundMode === "solid")
                : "cutout.png"
            }
            onDownload={handleDownload}
            onReset={handleReset}
            sizeBytes={rawResult.size}
            originalSizeBytes={selectedFile?.size}
            executionTimeMs={rawResult.processingTimeMs}
          />

          {/* Processing Metrics Summary Card */}
          <Card className="p-4 text-xs text-muted-foreground">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <span className="block font-medium text-foreground">Output Format</span>
                <span>PNG (Lossless Alpha)</span>
              </div>
              <div>
                <span className="block font-medium text-foreground">Resolution</span>
                <span>
                  {rawResult.width} × {rawResult.height} px
                </span>
              </div>
              <div>
                <span className="block font-medium text-foreground">Processing Device</span>
                <span className="capitalize">{rawResult.executionDevice}</span>
              </div>
              <div>
                <span className="block font-medium text-foreground">Model Variant</span>
                <span className="capitalize">{rawResult.modelUsed}</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
