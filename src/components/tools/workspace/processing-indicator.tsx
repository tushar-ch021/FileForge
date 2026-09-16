"use client";

import React from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingIndicatorProps {
  progress?: number;
  statusText?: string;
  className?: string;
}

export function ProcessingIndicator({
  progress,
  statusText = "Processing files locally in your browser...",
  className,
}: ProcessingIndicatorProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-slate-200 bg-white shadow-xs space-y-5",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h4 className="text-base font-bold text-slate-900">{statusText}</h4>
        <p className="text-xs text-slate-500">
          Heavy operations compute directly on your device CPU/GPU.
        </p>
      </div>

      {typeof progress === "number" && (
        <div className="w-full max-w-xs space-y-1.5">
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-blue-600 transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p className="text-right text-xs font-mono font-medium text-slate-500">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>100% Private: No files sent over the internet</span>
      </div>
    </div>
  );
}
