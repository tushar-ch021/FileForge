"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  ArrowUp,
  ArrowDown,
  Trash2,
  RotateCcw,
  ShieldCheck,
  Sliders,
  FileImage,
  GripVertical,
  Plus,
  Download,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileDropzone,
  ProcessingIndicator,
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
} from "@/lib/image/image-to-pdf";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { ObjectUrlManager } from "@/lib/workspace/url";
import { getErrorMessage } from "@/lib/workspace/errors";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";
import { cn } from "@/lib/utils";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB per file
  minSizeBytes: 1,
  acceptedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFiles: 50,
};

export function JpgToPdfTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [items, setItems] = useState<PdfImageItem[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // PDF Configuration State
  const [pageSize, setPageSize] = useState<PdfPageSize>("a4");
  const [orientation, setOrientation] = useState<PdfOrientation>("auto");
  const [fit, setFit] = useState<PdfImageFit>("contain");
  const [margin, setMargin] = useState<PdfMargin>("small");
  const [outputFilename, setOutputFilename] = useState<string>("jpg-to-pdf.pdf");

  // Reordering Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Hidden input for adding more files
  const addMoreInputRef = useRef<HTMLInputElement>(null);

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
          if (items.length + newItems.length >= 50) {
            setGeneralError("Maximum of 50 images allowed.");
            break;
          }
          const item = await createPdfImageItem(file, (f) => urlManager.create(f));
          newItems.push(item);
        }
        setItems((prev) => [...prev, ...newItems]);
        setStatus("idle");
      } catch (err) {
        setGeneralError(getErrorMessage(err));
      }
    },
    [items.length, urlManager]
  );

  // Reordering
  const moveItem = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        urlManager.revoke(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
    if (items.length <= 1) {
      setResult(null);
    }
  };

  // Drag and Drop reorder handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    setItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(draggedIndex, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Execution
  const handleConvert = async () => {
    if (items.length === 0) return;

    setStatus("processing");
    setGeneralError(null);

    try {
      const res = await convertImagesToPdf(items, {
        pageSize,
        orientation,
        fit,
        margin,
      });

      setResult(res);
      setStatus("success");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setStatus("error");
    }
  };

  const handleDownload = () => {
    if (!result) return;
    let name = outputFilename.trim();
    if (!name.toLowerCase().endsWith(".pdf")) name += ".pdf";
    downloadBlob(result.blob, name);
  };

  const handleReset = () => {
    urlManager.revokeAll();
    setItems([]);
    setResult(null);
    setGeneralError(null);
    setStatus("idle");
  };

  return (
    <div className="w-full space-y-6">
      {/* Error Alert */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onRetry={items.length > 0 ? handleConvert : undefined}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* STATE 1: Empty / Initial Dropzone */}
      {items.length === 0 && status !== "processing" && (
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          validationOptions={DROPZONE_VALIDATION}
          title="Drop your JPG images here to convert to PDF"
          subtitle="Supports JPG, JPEG (up to 50 images, 50MB each) • 100% In-browser"
          multiple={true}
          disabled={status === "validating"}
        />
      )}

      {/* STATE 2: Processing */}
      {status === "processing" && (
        <ProcessingIndicator statusText="Generating PDF from images..." />
      )}

      {/* STATE 3: Success View */}
      {status === "success" && result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  PDF Generated Successfully!
                </h3>
                <p className="text-xs text-slate-500">
                  Compiled {result.pageCount} {result.pageCount === 1 ? "page" : "pages"} in {Math.round(result.processingTimeMs)}ms
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                size="default"
                onClick={handleDownload}
                className="gap-2 shadow-sm font-semibold"
                id="download-jpg-pdf-button"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={handleReset}
                className="gap-2"
                id="convert-more-jpg-button"
              >
                <RotateCcw className="h-4 w-4" />
                Convert More Images
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Pages Created
              </span>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {result.pageCount}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Output File Size
              </span>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {formatBytes(result.size)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Filename
              </span>
              <p className="text-sm font-bold text-slate-900 truncate" title={outputFilename}>
                {outputFilename}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Images converted directly in your browser without uploading to any server.</span>
          </div>
        </div>
      )}

      {/* STATE 4: Workspace / Configuration State */}
      {items.length > 0 && status !== "success" && status !== "processing" && (
        <div className="space-y-6">
          {/* Header Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <FileImage className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {items.length} {items.length === 1 ? "image" : "images"} selected
                </h3>
                <p className="text-xs text-slate-500">
                  Arrange order or adjust PDF page dimensions and margins below
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={addMoreInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    handleFilesSelected(Array.from(e.target.files));
                    e.target.value = "";
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addMoreInputRef.current?.click()}
                disabled={items.length >= 50}
                className="gap-1.5 text-xs font-medium"
                id="add-more-jpg-button"
              >
                <Plus className="h-3.5 w-3.5" />
                Add More Images
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-1.5 text-xs text-slate-500 hover:text-rose-600"
                id="reset-jpg-button"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>

          {/* Image List with Reordering */}
          <div className="space-y-2.5" role="list" aria-label="Images to convert to PDF">
            {items.map((item, index) => {
              const isFirst = index === 0;
              const isLast = index === items.length - 1;
              const isDragging = draggedIndex === index;
              const isOver = dragOverIndex === index;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  role="listitem"
                  aria-label={`Page ${index + 1}: ${item.file.name}`}
                  className={cn(
                    "group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-white shadow-2xs transition-all duration-150",
                    isDragging && "opacity-40 scale-[0.99] border-blue-400 bg-blue-50/20",
                    isOver && "border-blue-500 ring-2 ring-blue-100 bg-blue-50/30",
                    !isDragging && !isOver && "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1 -ml-1 rounded transition-colors"
                      title="Drag to reorder"
                      aria-label={`Drag to reorder ${item.file.name}`}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>

                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-700 shrink-0">
                      {index + 1}
                    </div>

                    {/* Thumbnail Preview */}
                    <div className="h-12 w-12 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span>{item.width} × {item.height} px</span>
                        <span>•</span>
                        <span>{formatBytes(item.size)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveItem(index, "up")}
                      disabled={isFirst}
                      aria-label={`Move ${item.file.name} up`}
                      title="Move Image up"
                      className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveItem(index, "down")}
                      disabled={isLast}
                      aria-label={`Move ${item.file.name} down`}
                      title="Move Image down"
                      className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>

                    <div className="h-4 w-[1px] bg-slate-200 mx-1" />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                      title="Remove Image"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PDF Generation Settings */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              <Sliders className="h-4 w-4 text-blue-600" />
              <span>PDF Page & Layout Settings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Page Size */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Page Size
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as PdfPageSize)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="a5">A5 (148 × 210 mm)</option>
                  <option value="letter">US Letter (8.5 × 11 in)</option>
                  <option value="legal">US Legal (8.5 × 14 in)</option>
                  <option value="original">Original Image Dimensions</option>
                </select>
              </div>

              {/* Orientation */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Orientation
                </label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as PdfOrientation)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">Auto (Match Image Ratio)</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              {/* Margins */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Page Margins
                </label>
                <select
                  value={margin}
                  onChange={(e) => setMargin(e.target.value as PdfMargin)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">None (0 mm)</option>
                  <option value="small">Small (10 mm)</option>
                  <option value="medium">Medium (20 mm)</option>
                  <option value="large">Large (30 mm)</option>
                </select>
              </div>

              {/* Fit Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Image Fit
                </label>
                <select
                  value={fit}
                  onChange={(e) => setFit(e.target.value as PdfImageFit)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="contain">Fit to Page (Maintain Aspect)</option>
                  <option value="cover">Fill Page (Center Crop)</option>
                  <option value="original">Original Size (No Scaling)</option>
                </select>
              </div>
            </div>

            {/* Filename & Action */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xs w-full">
                <label
                  htmlFor="jpg-to-pdf-filename-input"
                  className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
                >
                  Output Filename
                </label>
                <input
                  id="jpg-to-pdf-filename-input"
                  type="text"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  placeholder="jpg-to-pdf.pdf"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <Button
                size="lg"
                onClick={handleConvert}
                disabled={items.length === 0}
                className="gap-2 shadow-sm font-semibold text-sm px-6"
                id="convert-jpg-to-pdf-submit-button"
              >
                <FileText className="h-4 w-4" />
                Convert {items.length} {items.length === 1 ? "Image" : "Images"} to PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
