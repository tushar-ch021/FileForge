"use client";

import React from "react";
import { CheckCircle2, Download, RotateCcw, FileText, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, calculateSavings } from "@/lib/workspace/file-validator";
import { cn } from "@/lib/utils";

interface ResultViewProps {
  filename: string;
  onDownload: () => void;
  onReset: () => void;
  sizeBytes?: number;
  originalSizeBytes?: number;
  executionTimeMs?: number;
  previewNode?: React.ReactNode;
  className?: string;
}

export function ResultView({
  filename,
  onDownload,
  onReset,
  sizeBytes,
  originalSizeBytes,
  executionTimeMs,
  previewNode,
  className,
}: ResultViewProps) {
  const savings =
    originalSizeBytes && sizeBytes
      ? calculateSavings(originalSizeBytes, sizeBytes)
      : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-2xl border border-slate-200 bg-white shadow-xs space-y-6",
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-2xs">
        <CheckCircle2 className="h-9 w-9" />
      </div>

      <div className="space-y-2 max-w-md">
        <h4 className="text-xl font-bold text-slate-900">
          Ready for Download
        </h4>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
          <FileText className="h-3.5 w-3.5 text-slate-400" />
          <span className="truncate max-w-[200px] sm:max-w-[280px]">{filename}</span>
          {sizeBytes !== undefined && (
            <span className="font-semibold text-slate-900 border-l border-slate-200 pl-2">
              {formatBytes(sizeBytes)}
            </span>
          )}
        </div>
      </div>

      {/* Savings Metric if applicable */}
      {savings && savings.isSmaller && (
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <ArrowDownRight className="h-4 w-4" />
          <span>
            Reduced by {savings.percentageSaved}% (Saved {formatBytes(savings.bytesSaved)})
          </span>
        </div>
      )}

      {/* Optional Preview Element */}
      {previewNode && (
        <div className="w-full max-h-72 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
          {previewNode}
        </div>
      )}

      {/* Execution Time Notice */}
      {executionTimeMs !== undefined && (
        <p className="text-[11px] text-slate-400">
          Processed locally in {Math.round(executionTimeMs)}ms
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button size="lg" onClick={onDownload} className="gap-2 shadow-sm">
          <Download className="h-4 w-4" />
          Download File
        </Button>
        <Button variant="outline" size="lg" onClick={onReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Process Another
        </Button>
      </div>
    </div>
  );
}
