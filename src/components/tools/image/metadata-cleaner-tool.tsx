"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Camera,
  MapPin,
  Sliders,
  Calendar,
  ExternalLink,
  Sparkles,
  Info,
  RotateCcw,
  CheckCircle2,
  FileImage,
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
  extractImageMetadata,
  cleanImageMetadata,
  generateCleanedFilename,
  ParsedImageMetadata,
  CleanMetadataResult,
} from "@/lib/image/metadata-cleaner";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { ObjectUrlManager } from "@/lib/workspace/url";
import { getErrorMessage } from "@/lib/workspace/errors";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  minSizeBytes: 1,
  acceptedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFiles: 1,
};

export function MetadataCleanerTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceMetadata, setSourceMetadata] = useState<ParsedImageMetadata | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string>("");

  // Cleaning Settings
  const [quality, setQuality] = useState<number>(80);
  const [showAllTags, setShowAllTags] = useState<boolean>(false);

  // Result State
  const [cleanResult, setCleanResult] = useState<CleanMetadataResult | null>(null);
  const [cleanedPreviewUrl, setCleanedPreviewUrl] = useState<string>("");
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Memory manager
  const [urlManager] = useState(() => new ObjectUrlManager());

  useEffect(() => {
    return () => {
      urlManager.revokeAll();
    };
  }, [urlManager]);

  const clearPreviewUrls = useCallback(() => {
    if (sourcePreviewUrl) {
      urlManager.revoke(sourcePreviewUrl);
      setSourcePreviewUrl("");
    }
    if (cleanedPreviewUrl) {
      urlManager.revoke(cleanedPreviewUrl);
      setCleanedPreviewUrl("");
    }
  }, [sourcePreviewUrl, cleanedPreviewUrl, urlManager]);

  // Handle image upload
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (!files || files.length === 0) return;
      const file = files[0];

      setGeneralError(null);
      clearPreviewUrls();
      setCleanResult(null);

      try {
        const metadata = await extractImageMetadata(file);
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

  // Handle image sanitization
  const handleClean = async () => {
    if (!selectedFile) return;

    setStatus("processing");
    setGeneralError(null);

    try {
      const result = await cleanImageMetadata(selectedFile, {
        quality: quality / 100,
      });

      const cleanUrl = urlManager.create(result.blob);
      setCleanResult(result);
      setCleanedPreviewUrl(cleanUrl);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setGeneralError(getErrorMessage(err));
    }
  };

  // Download cleaned file
  const handleDownload = () => {
    if (!selectedFile || !cleanResult) return;
    const filename = generateCleanedFilename(selectedFile.name, cleanResult.format);
    downloadBlob(cleanResult.blob, filename);
  };

  // Reset tool state
  const handleReset = () => {
    clearPreviewUrls();
    setSelectedFile(null);
    setSourceMetadata(null);
    setCleanResult(null);
    setStatus("idle");
    setGeneralError(null);
  };

  const isLossy = selectedFile && (selectedFile.type === "image/jpeg" || selectedFile.type === "image/webp");

  return (
    <div className="space-y-6">
      {/* Privacy Guarantee Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/20 px-4 py-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>
            <strong>100% Client-Side Inspection:</strong> Your photos and embedded EXIF tags are
            analyzed and stripped in your browser with zero server uploads.
          </span>
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
            title="Drop photo to inspect & strip metadata"
            subtitle="Supports JPG, PNG, and WebP files up to 50MB"
          />

          <Card className="flex items-start gap-3 border-dashed border-border/70 bg-card/40 p-4 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">Why strip metadata?</p>
              <p className="mt-0.5 leading-relaxed">
                Photos taken on modern smartphones and digital cameras often contain hidden EXIF
                headers, including exact GPS home/work coordinates, serial numbers, timestamps, and
                camera models. Sanitizing removes these tracking tags before sharing photos online.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Step 2: Inspection & Cleaning Settings */}
      {selectedFile && sourceMetadata && status !== "success" && (
        <div className="space-y-6">
          {/* File Overview Card */}
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
                      {sourceMetadata.format}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sourceMetadata.width} × {sourceMetadata.height} px •{" "}
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

          {/* Privacy Assessment Alert */}
          {sourceMetadata.hasGps ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-800 dark:text-rose-300">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="space-y-1">
                <p className="font-semibold">Sensitive Geolocation Detected</p>
                <p>
                  This photo embeds exact GPS coordinates (
                  {sourceMetadata.gps.formattedCoordinates || "Location data"}). Stripping metadata
                  before posting is strongly recommended.
                </p>
              </div>
            </div>
          ) : sourceMetadata.hasExif ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-300">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">
                  Embedded EXIF Headers Detected ({sourceMetadata.totalTagCount} tags)
                </p>
                <p>
                  Camera device information and capture settings are stored inside this file.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-semibold">No Embedded EXIF or GPS Data Found</p>
                <p>This image already appears to be free of personal device and location tags.</p>
              </div>
            </div>
          )}

          {/* Categorized Metadata Inspector Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* 1. Camera & Device */}
            <Card className="space-y-2 p-4">
              <div className="flex items-center gap-2 border-b border-border/50 pb-2 text-xs font-semibold text-foreground">
                <Camera className="h-4 w-4 text-primary" />
                <span>Camera & Device</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Make:</span>
                  <span className="font-medium text-foreground">
                    {sourceMetadata.camera.make || "Not available"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Model:</span>
                  <span className="font-medium text-foreground">
                    {sourceMetadata.camera.model || "Not available"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Software:</span>
                  <span className="font-medium text-foreground truncate max-w-[150px]">
                    {sourceMetadata.camera.software || "Not available"}
                  </span>
                </div>
                {sourceMetadata.camera.lensModel && (
                  <div className="flex justify-between">
                    <span>Lens:</span>
                    <span className="font-medium text-foreground truncate max-w-[150px]">
                      {sourceMetadata.camera.lensModel}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* 2. Capture Settings */}
            <Card className="space-y-2 p-4">
              <div className="flex items-center gap-2 border-b border-border/50 pb-2 text-xs font-semibold text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Capture Settings</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Date/Time:</span>
                  <span className="font-medium text-foreground">
                    {sourceMetadata.capture.dateTime || "Not available"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Exposure:</span>
                  <span className="font-medium text-foreground">
                    {sourceMetadata.capture.exposureTime
                      ? `${sourceMetadata.capture.exposureTime}s`
                      : "Not available"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Aperture:</span>
                  <span className="font-medium text-foreground">
                    {sourceMetadata.capture.fNumber
                      ? `f/${sourceMetadata.capture.fNumber}`
                      : "Not available"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ISO:</span>
                  <span className="font-medium text-foreground">
                    {sourceMetadata.capture.iso || "Not available"}
                  </span>
                </div>
              </div>
            </Card>

            {/* 3. Location / GPS */}
            <Card className="space-y-2 p-4">
              <div className="flex items-center gap-2 border-b border-border/50 pb-2 text-xs font-semibold text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>GPS Location</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Coordinates:</span>
                  <span className="font-medium text-foreground">
                    {sourceMetadata.gps.formattedCoordinates || "Not available"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Altitude:</span>
                  <span className="font-medium text-foreground">
                    {sourceMetadata.gps.altitude || "Not available"}
                  </span>
                </div>
                {sourceMetadata.gps.mapsUrl && (
                  <div className="pt-1">
                    <a
                      href={sourceMetadata.gps.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View location on Google Maps
                    </a>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Full Tag Details Toggle */}
          {sourceMetadata.tagsList.length > 0 && (
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllTags(!showAllTags)}
                className="text-xs text-muted-foreground"
              >
                {showAllTags
                  ? "Hide Raw EXIF Tags"
                  : `View All ${sourceMetadata.tagsList.length} Embedded Tags`}
              </Button>

              {showAllTags && (
                <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-border/60 bg-secondary/20 p-3 text-left">
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {sourceMetadata.tagsList.map((tag) => (
                      <div
                        key={tag.name}
                        className="flex items-baseline justify-between gap-2 border-b border-border/30 py-1 text-[11px]"
                      >
                        <span className="font-mono text-muted-foreground">{tag.name}:</span>
                        <span className="truncate font-medium text-foreground">{tag.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Processing Settings & Trigger Card */}
          {status !== "processing" && (
            <Card className="space-y-4 p-5">
              {isLossy && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Sliders className="h-3.5 w-3.5 text-primary" />
                      <span>Re-encoding Quality</span>
                    </div>
                    <span className="font-mono text-primary">{quality}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer accent-primary"
                    aria-label="Re-encoding quality"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Recommended: 80% retains high visual fidelity while removing metadata.
                  </p>
                </div>
              )}

              <Button
                size="lg"
                onClick={handleClean}
                className="w-full gap-2 text-sm font-medium sm:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                Clean & Strip Metadata
              </Button>
            </Card>
          )}

          {/* Processing Indicator */}
          {status === "processing" && (
            <Card className="p-6 text-center">
              <ProcessingIndicator statusText="Re-encoding image and stripping metadata headers..." />
            </Card>
          )}
        </div>
      )}

      {/* Step 3: Cleaned Results View */}
      {status === "success" && cleanResult && (
        <div className="space-y-6">
          {/* Verification Banner */}
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="font-semibold">Metadata Removed During Re-encoding</p>
              <p>
                The image has been freshly re-encoded via browser Canvas. Inspection confirms{" "}
                <strong>{cleanResult.verifiedRemainingTagCount}</strong> metadata tags remain in the
                clean output.
              </p>
            </div>
          </div>

          {/* Side-by-Side Before & After Preview */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Original Card */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/50 bg-secondary/30 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Original (With Metadata)
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {cleanResult.originalMetadata.totalTagCount} Tags
                </Badge>
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
              <div className="border-t border-border/40 p-3 text-xs text-muted-foreground">
                <p>
                  Size: {formatBytes(cleanResult.originalMetadata.fileSize)} • GPS:{" "}
                  {cleanResult.originalMetadata.hasGps ? "Present" : "None"}
                </p>
              </div>
            </Card>

            {/* Cleaned Card */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/50 bg-secondary/30 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sanitized Copy
                </span>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  Clean (0 EXIF)
                </Badge>
              </div>
              <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-secondary/20 p-4">
                {cleanedPreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cleanedPreviewUrl}
                    alt="Sanitized photo"
                    className="max-h-full max-w-full rounded object-contain shadow-xs"
                  />
                )}
              </div>
              <div className="border-t border-border/40 p-3 text-xs text-muted-foreground">
                <p>
                  Size: {formatBytes(cleanResult.size)} • Metadata: Removed
                </p>
              </div>
            </Card>
          </div>

          {/* Result Action Bar */}
          <ResultView
            filename={
              selectedFile
                ? generateCleanedFilename(selectedFile.name, cleanResult.format)
                : "photo-cleaned.jpg"
            }
            onDownload={handleDownload}
            onReset={handleReset}
            sizeBytes={cleanResult.size}
            originalSizeBytes={selectedFile?.size}
            executionTimeMs={cleanResult.processingTimeMs}
          />
        </div>
      )}
    </div>
  );
}
