"use client";

import React from "react";
import { FileDropzone } from "./file-dropzone";
import { ProcessingIndicator } from "./processing-indicator";
import { ResultView } from "./result-view";
import { ErrorAlert } from "./error-alert";
import { FileValidationOptions, ProcessingStatus, ToolExecutionResult } from "@/types/workspace";
import { cn } from "@/lib/utils";

interface ToolWorkspaceShellProps {
  status: ProcessingStatus;
  hasFiles: boolean;
  onFilesSelected: (files: File[]) => void;
  onReset: () => void;
  onDownload: () => void;
  result?: ToolExecutionResult | null;
  error?: string | null;
  progress?: number;
  validationOptions?: FileValidationOptions;
  dropzoneTitle?: string;
  dropzoneSubtitle?: string;
  multiple?: boolean;
  statusText?: string;
  settingsSlot?: React.ReactNode;
  previewNode?: React.ReactNode;
  className?: string;
}

export function ToolWorkspaceShell({
  status,
  hasFiles,
  onFilesSelected,
  onReset,
  onDownload,
  result,
  error,
  progress,
  validationOptions,
  dropzoneTitle,
  dropzoneSubtitle,
  multiple = false,
  statusText,
  settingsSlot,
  previewNode,
  className,
}: ToolWorkspaceShellProps) {
  return (
    <div className={cn("w-full space-y-6", className)}>
      {/* Error Alert Display */}
      {error && (
        <ErrorAlert
          message={error}
          onRetry={hasFiles ? onReset : undefined}
          onDismiss={onReset}
        />
      )}

      {/* 1. Success State: Result View */}
      {status === "success" && result ? (
        <ResultView
          filename={result.filename || "output"}
          sizeBytes={result.sizeBytes}
          originalSizeBytes={result.originalSizeBytes}
          executionTimeMs={result.executionTimeMs}
          previewNode={previewNode}
          onDownload={onDownload}
          onReset={onReset}
        />
      ) : status === "processing" || status === "reading" ? (
        /* 2. Processing State: Indicator */
        <ProcessingIndicator progress={progress} statusText={statusText} />
      ) : !hasFiles ? (
        /* 3. Idle / Empty State: Dropzone */
        <FileDropzone
          onFilesSelected={onFilesSelected}
          validationOptions={validationOptions}
          title={dropzoneTitle}
          subtitle={dropzoneSubtitle}
          multiple={multiple}
        />
      ) : (
        /* 4. Files Selected / Settings Ready State */
        <div className="space-y-6">
          {settingsSlot}
        </div>
      )}
    </div>
  );
}

export { FileDropzone, ProcessingIndicator, ResultView, ErrorAlert };
