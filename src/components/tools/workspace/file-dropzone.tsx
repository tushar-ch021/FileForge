"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, File, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileValidationOptions } from "@/types/workspace";
import { validateFiles, formatBytes } from "@/lib/workspace/file-validator";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  validationOptions?: FileValidationOptions;
  title?: string;
  subtitle?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FileDropzone({
  onFilesSelected,
  validationOptions = {},
  title = "Drop your files here",
  subtitle = "or click to browse from your device",
  multiple = false,
  disabled = false,
  className,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (incomingFiles: FileList | null) => {
    if (!incomingFiles || incomingFiles.length === 0 || disabled) return;
    setLocalError(null);

    const fileList = Array.from(incomingFiles);
    const validation = validateFiles(fileList, validationOptions);

    if (!validation.isValid) {
      setLocalError(validation.error || "Selected file is invalid.");
      return;
    }

    onFilesSelected(fileList);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center cursor-pointer transition-all duration-200",
          isDragOver
            ? "border-blue-600 bg-blue-50/50 scale-[1.005]"
            : "border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/20",
          disabled && "opacity-50 pointer-events-none cursor-not-allowed"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={
            validationOptions.acceptedExtensions?.join(",") ||
            validationOptions.acceptedMimeTypes?.join(",")
          }
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
          className="hidden"
          aria-label="Upload file"
        />

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-xs text-blue-600 mb-4 transition-transform duration-200 group-hover:scale-105">
          <UploadCloud className="h-7 w-7" />
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-600 mb-5">{subtitle}</p>

        <Button
          type="button"
          size="default"
          className="shadow-xs gap-2 pointer-events-none"
        >
          <File className="h-4 w-4" />
          Select {multiple ? "Files" : "File"}
        </Button>

        {/* Accepted formats & size pills */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          {validationOptions.acceptedExtensions && (
            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-mono font-medium text-slate-600">
              {validationOptions.acceptedExtensions.join(", ").toUpperCase()}
            </span>
          )}
          {validationOptions.maxSizeBytes && (
            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-500">
              Max {formatBytes(validationOptions.maxSizeBytes)}
            </span>
          )}
        </div>
      </div>

      {localError && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-700 bg-rose-50 rounded-xl border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{localError}</span>
        </div>
      )}
    </div>
  );
}
