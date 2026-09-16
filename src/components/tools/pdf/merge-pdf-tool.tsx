"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Download,
  RotateCcw,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Layers,
  FilePlus2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileDropzone,
  ProcessingIndicator,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  mergePdfs,
  MergePdfResult,
  MERGE_LIMITS,
} from "@/lib/pdf/merge-pdf";
import { getPdfDocumentInfo, PdfDocumentInfo } from "@/lib/pdf/common";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { ObjectUrlManager } from "@/lib/workspace/url";
import { getErrorMessage } from "@/lib/workspace/errors";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";
import { cn } from "@/lib/utils";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: MERGE_LIMITS.maxFileSizeBytes,
  minSizeBytes: 1,
  acceptedExtensions: [".pdf"],
  acceptedMimeTypes: ["application/pdf"],
  maxFiles: MERGE_LIMITS.maxFiles,
};

interface MergeFileItem {
  id: string;
  file: File;
  info: PdfDocumentInfo;
}

export function MergePdfTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [items, setItems] = useState<MergeFileItem[]>([]);
  const [processingStage, setProcessingStage] = useState<string>("Analyzing PDFs...");
  const [outputFilename, setOutputFilename] = useState<string>("merged.pdf");
  const [result, setResult] = useState<MergePdfResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Drag-and-drop state for reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Hidden input ref for "Add More Files"
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Object URL Manager for clean memory lifecycle
  const [urlManager] = useState(() => new ObjectUrlManager());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      urlManager.revokeAll();
    };
  }, [urlManager]);

  // Aggregate totals
  const totalPages = items.reduce((sum, item) => sum + item.info.pageCount, 0);
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);

  // Add files to list with validation and page counting
  const processIncomingFiles = async (incomingFiles: File[]) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    setGeneralError(null);
    setStatus("validating");

    const newItems: MergeFileItem[] = [];
    const existingNames = new Set(items.map((it) => `${it.file.name}_${it.file.size}`));

    let errorOccurred: string | null = null;

    for (const file of incomingFiles) {
      if (items.length + newItems.length >= MERGE_LIMITS.maxFiles) {
        errorOccurred = `You can merge up to ${MERGE_LIMITS.maxFiles} files at once. Extra files were not added.`;
        break;
      }

      const key = `${file.name}_${file.size}`;
      if (existingNames.has(key)) {
        continue; // skip duplicate exact files
      }

      try {
        const info = await getPdfDocumentInfo(file);
        if (info.isEncrypted) {
          errorOccurred = `"${file.name}" is password protected or cannot be opened. Please unlock it before adding.`;
          continue;
        }

        newItems.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          file,
          info,
        });
        existingNames.add(key);
      } catch (err) {
        errorOccurred = getErrorMessage(err);
      }
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      setStatus("idle");
    } else {
      setStatus(items.length > 0 ? "idle" : "idle");
    }

    if (errorOccurred) {
      setGeneralError(errorOccurred);
    }
  };

  // Reordering handlers
  const moveItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    setItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (items.length <= 1) {
      setResult(null);
    }
  };

  // HTML5 Drag-and-drop reordering
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

  // Execute merge
  const handleMerge = async () => {
    if (items.length < MERGE_LIMITS.minFiles) {
      setGeneralError(`Please upload at least ${MERGE_LIMITS.minFiles} PDF files to merge.`);
      return;
    }

    setStatus("processing");
    setGeneralError(null);
    setProcessingStage("Analyzing PDFs...");

    try {
      const filesToMerge = items.map((it) => it.file);
      const res = await mergePdfs(filesToMerge, {
        outputFilename,
        onProgress: (stage) => setProcessingStage(stage),
      });

      setResult(res);
      setStatus("success");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setStatus("error");
    }
  };

  // Download merged PDF
  const handleDownload = () => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  };

  // Reset entire workspace
  const handleReset = () => {
    urlManager.revokeAll();
    setItems([]);
    setResult(null);
    setGeneralError(null);
    setOutputFilename("merged.pdf");
    setStatus("idle");
  };

  return (
    <div className="w-full space-y-6">
      {/* Error Alert */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onRetry={items.length >= MERGE_LIMITS.minFiles ? handleMerge : undefined}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* STATE 1: Initial Empty Dropzone */}
      {items.length === 0 && status !== "processing" && (
        <FileDropzone
          onFilesSelected={processIncomingFiles}
          validationOptions={DROPZONE_VALIDATION}
          title="Drop your PDF files here to merge"
          subtitle="Select 2 to 20 PDF documents up to 50MB each • 100% in-browser"
          multiple={true}
          disabled={status === "validating"}
        />
      )}

      {/* STATE 2: Processing Indicator */}
      {status === "processing" && (
        <ProcessingIndicator statusText={processingStage} />
      )}

      {/* STATE 3: Success View */}
      {status === "success" && result && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-emerald-50 text-emerald-600 border-emerald-200 shadow-2xs">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    PDFs Merged Successfully!
                  </h3>
                  <p className="text-xs text-slate-500">
                    Combined {result.fileCount} files into 1 document in {Math.round(result.executionTimeMs)}ms
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  size="default"
                  onClick={handleDownload}
                  className="gap-2 shadow-sm font-semibold"
                  id="download-merged-pdf-button"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleReset}
                  className="gap-2"
                  id="merge-another-pdf-button"
                >
                  <RotateCcw className="h-4 w-4" />
                  Merge Another
                </Button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Files Merged
                </span>
                <p className="text-lg sm:text-xl font-bold text-slate-900">
                  {result.fileCount}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Total Pages
                </span>
                <p className="text-lg sm:text-xl font-bold text-slate-900">
                  {result.totalPageCount}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Output Size
                </span>
                <p className="text-lg sm:text-xl font-bold text-slate-900">
                  {formatBytes(result.outputSizeBytes)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Output Filename
                </span>
                <p className="text-sm font-bold text-slate-900 truncate" title={result.filename}>
                  {result.filename}
                </p>
              </div>
            </div>

            {/* Privacy Badge */}
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Your PDFs were processed entirely in your local browser sandbox. No server uploads occurred.</span>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: Files Uploaded / Active Management Workspace */}
      {items.length > 0 && status !== "success" && status !== "processing" && (
        <div className="space-y-6">
          {/* Workspace Header & Action Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {items.length} {items.length === 1 ? "file" : "files"} ready to merge
                </h3>
                <p className="text-xs text-slate-500">
                  {totalPages} total pages • {formatBytes(totalBytes)} • Arrange in desired order
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={addMoreInputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    processIncomingFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addMoreInputRef.current?.click()}
                disabled={items.length >= MERGE_LIMITS.maxFiles}
                className="gap-1.5 text-xs font-medium"
                id="add-more-pdfs-button"
              >
                <Plus className="h-3.5 w-3.5" />
                Add More PDFs
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-1.5 text-xs text-slate-500 hover:text-rose-600"
                id="clear-all-pdfs-button"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>

          {/* List of PDFs to Merge */}
          <div className="space-y-2.5" role="list" aria-label="PDF files to merge">
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
                  aria-label={`Position ${index + 1}: ${item.file.name}`}
                  className={cn(
                    "group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-white shadow-2xs transition-all duration-150",
                    isDragging && "opacity-40 scale-[0.99] border-blue-400 bg-blue-50/20",
                    isOver && "border-blue-500 ring-2 ring-blue-100 bg-blue-50/30",
                    !isDragging && !isOver && "border-slate-200 hover:border-slate-300"
                  )}
                >
                  {/* Left: Drag Handle, Number Badge, File Info */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
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

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {item.info.pageCount} {item.info.pageCount === 1 ? "page" : "pages"}
                        </span>
                        <span>•</span>
                        <span>{formatBytes(item.file.size)}</span>
                        <span>•</span>
                        <span className="text-slate-400">{item.info.pdfVersion}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Accessible Move Up / Move Down / Remove Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveItem(index, "up")}
                      disabled={isFirst}
                      aria-label={`Move ${item.file.name} up`}
                      title="Move PDF up"
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
                      title="Move PDF down"
                      className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>

                    <div className="h-4 w-[1px] bg-slate-200 mx-1" />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      aria-label={`Remove ${item.file.name}`}
                      title="Remove PDF"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Merge Settings & Output Customization */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <label
                  htmlFor="merged-pdf-filename-input"
                  className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
                >
                  Output Filename
                </label>
                <div className="flex items-center gap-2 max-w-sm">
                  <input
                    id="merged-pdf-filename-input"
                    type="text"
                    value={outputFilename}
                    onChange={(e) => setOutputFilename(e.target.value)}
                    placeholder="merged.pdf"
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Main Action Button */}
              <div className="flex items-center gap-3">
                <Button
                  size="lg"
                  onClick={handleMerge}
                  disabled={items.length < MERGE_LIMITS.minFiles}
                  className="gap-2 shadow-sm font-semibold text-sm px-6"
                  id="merge-pdfs-submit-button"
                >
                  <FilePlus2 className="h-4 w-4" />
                  Merge {items.length} PDFs ({totalPages} Pages)
                </Button>
              </div>
            </div>

            {items.length < MERGE_LIMITS.minFiles && (
              <p className="text-xs text-amber-600">
                Please add at least {MERGE_LIMITS.minFiles - items.length} more PDF file to enable merging.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
