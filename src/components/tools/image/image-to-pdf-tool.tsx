"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  ArrowUp,
  ArrowDown,
  Trash2,
  RotateCcw,
  ShieldCheck,
  Sliders,
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
  convertImagesToPdf,
  createPdfImageItem,
  PdfImageItem,
  PdfPageSize,
  PdfOrientation,
  PdfImageFit,
  PdfMargin,
  ImageToPdfResult,
  PAGE_SIZE_DIMENSIONS,
  MARGIN_VALUES,
} from "@/lib/image/image-to-pdf";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { ObjectUrlManager } from "@/lib/workspace/url";
import { getErrorMessage } from "@/lib/workspace/errors";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB per file
  minSizeBytes: 1,
  acceptedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFiles: 50,
};

export function ImageToPdfTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [items, setItems] = useState<PdfImageItem[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // PDF Configuration State
  const [pageSize, setPageSize] = useState<PdfPageSize>("a4");
  const [orientation, setOrientation] = useState<PdfOrientation>("auto");
  const [fit, setFit] = useState<PdfImageFit>("contain");
  const [margin, setMargin] = useState<PdfMargin>("small");

  // Result State
  const [result, setResult] = useState<ImageToPdfResult | null>(null);

  // Memory manager
  const [urlManager] = useState(() => new ObjectUrlManager());

  useEffect(() => {
    return () => {
      urlManager.revokeAll();
    };
  }, [urlManager]);

  // Append new files to queue
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (!files || files.length === 0) return;
      setGeneralError(null);

      try {
        const newItems: PdfImageItem[] = [];
        for (const file of files) {
          const item = await createPdfImageItem(file, (f) => urlManager.create(f));
          newItems.push(item);
        }
        setItems((prev) => [...prev, ...newItems]);
        setStatus("idle");
      } catch (err) {
        setGeneralError(getErrorMessage(err));
      }
    },
    [urlManager]
  );

  // Move item up
  const moveItemUp = (index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Move item down
  const moveItemDown = (index: number) => {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Remove individual item
  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        urlManager.revoke(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  // Generate PDF
  const handleGeneratePdf = async () => {
    if (items.length === 0) return;

    setStatus("processing");
    setGeneralError(null);

    try {
      const pdfResult = await convertImagesToPdf(items, {
        pageSize,
        orientation,
        fit,
        margin,
      });

      setResult(pdfResult);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setGeneralError(getErrorMessage(err));
    }
  };

  // Download PDF handler
  const handleDownload = () => {
    if (!result) return;
    downloadBlob(result.blob, "images-to-pdf.pdf");
  };

  // Reset tool
  const handleReset = () => {
    urlManager.revokeAll();
    setItems([]);
    setResult(null);
    setStatus("idle");
    setGeneralError(null);
  };

  const totalInputSize = items.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="space-y-6">
      {/* Privacy Guarantee */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/20 px-4 py-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>
            <strong>100% Client-Side PDF Creation:</strong> Your images are combined into a PDF
            locally in your browser with zero server uploads.
          </span>
        </div>
        {items.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {items.length} {items.length === 1 ? "Image" : "Images"} ({formatBytes(totalInputSize)})
          </Badge>
        )}
      </div>

      {/* Error Alert */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* Step 1: Initial Upload Dropzone when empty */}
      {items.length === 0 && (
        <FileDropzone
          validationOptions={DROPZONE_VALIDATION}
          onFilesSelected={handleFilesSelected}
          title="Drop one or multiple photos to convert to PDF"
          subtitle="Supports JPG, PNG, and WebP (up to 50 images)"
          multiple
        />
      )}

      {/* Step 2: Queue Management & Settings */}
      {items.length > 0 && status !== "success" && (
        <div className="space-y-6">
          {/* Document Settings Grid */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                <Sliders className="h-4 w-4 text-primary" />
                <span>PDF Document Settings</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs text-muted-foreground"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Clear All
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              {/* 1. Page Size */}
              <div className="space-y-1.5">
                <label className="font-medium text-foreground">Page Size</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as PdfPageSize)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label="Page Size"
                >
                  <option value="a4">{PAGE_SIZE_DIMENSIONS.a4.label}</option>
                  <option value="letter">{PAGE_SIZE_DIMENSIONS.letter.label}</option>
                  <option value="a5">{PAGE_SIZE_DIMENSIONS.a5.label}</option>
                  <option value="legal">{PAGE_SIZE_DIMENSIONS.legal.label}</option>
                  <option value="original">Fit Image Size (No Blank Edges)</option>
                </select>
              </div>

              {/* 2. Orientation */}
              <div className="space-y-1.5">
                <label className="font-medium text-foreground">Orientation</label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as PdfOrientation)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label="Orientation"
                >
                  <option value="auto">Auto (Match Image Proportions)</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              {/* 3. Image Fit */}
              <div className="space-y-1.5">
                <label className="font-medium text-foreground">Image Fit</label>
                <select
                  value={fit}
                  onChange={(e) => setFit(e.target.value as PdfImageFit)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label="Image Fit"
                >
                  <option value="contain">Fit to Page (Maintain Aspect Ratio)</option>
                  <option value="cover">Fill Entire Page</option>
                  <option value="original">Original Dimensions</option>
                </select>
              </div>

              {/* 4. Margin */}
              <div className="space-y-1.5">
                <label className="font-medium text-foreground">Margins</label>
                <select
                  value={margin}
                  onChange={(e) => setMargin(e.target.value as PdfMargin)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label="Margins"
                >
                  <option value="none">{MARGIN_VALUES.none.label}</option>
                  <option value="small">{MARGIN_VALUES.small.label}</option>
                  <option value="medium">{MARGIN_VALUES.medium.label}</option>
                  <option value="large">{MARGIN_VALUES.large.label}</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Image Queue List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Page Sequence ({items.length} {items.length === 1 ? "page" : "pages"})
              </span>
              <span className="text-xs text-muted-foreground">
                Reorder using arrows before compiling
              </span>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <Card
                  key={item.id}
                  className="flex items-center justify-between p-3 transition-colors hover:bg-secondary/20"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className="h-6 w-16 justify-center text-[10px] font-mono shrink-0"
                    >
                      Page {index + 1}
                    </Badge>

                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-secondary/50">
                      {item.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileImage className="h-6 w-6 text-muted-foreground m-auto" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-xs font-medium text-foreground max-w-[200px] sm:max-w-md">
                        {item.file.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.width} × {item.height} px • {formatBytes(item.size)}
                      </p>
                    </div>
                  </div>

                  {/* Accessible Reordering Controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => moveItemUp(index)}
                      disabled={index === 0}
                      title="Move page up"
                      aria-label={`Move page ${index + 1} up`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => moveItemDown(index)}
                      disabled={index === items.length - 1}
                      title="Move page down"
                      aria-label={`Move page ${index + 1} down`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                      onClick={() => removeItem(item.id)}
                      title="Remove page"
                      aria-label={`Remove page ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Quick Add More Images Button */}
            <div className="pt-2">
              <FileDropzone
                validationOptions={DROPZONE_VALIDATION}
                onFilesSelected={handleFilesSelected}
                title="Add more photos to this document"
                subtitle="Drop additional images here to append"
                multiple
              />
            </div>
          </div>

          {/* Action Trigger Button */}
          {status !== "processing" && (
            <div className="pt-2">
              <Button
                size="lg"
                onClick={handleGeneratePdf}
                className="w-full gap-2 text-sm font-medium sm:w-auto"
              >
                <FileText className="h-4 w-4" />
                Generate PDF ({items.length} {items.length === 1 ? "Page" : "Pages"})
              </Button>
            </div>
          )}

          {/* Processing Indicator */}
          {status === "processing" && (
            <Card className="p-6 text-center">
              <ProcessingIndicator statusText="Compiling multi-page PDF document locally..." />
            </Card>
          )}
        </div>
      )}

      {/* Step 3: Success View */}
      {status === "success" && result && (
        <div className="space-y-6">
          <ResultView
            filename="images-to-pdf.pdf"
            onDownload={handleDownload}
            onReset={handleReset}
            sizeBytes={result.size}
            originalSizeBytes={totalInputSize}
            executionTimeMs={result.processingTimeMs}
          />
        </div>
      )}
    </div>
  );
}
