"use client";

import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorAlert({
  message,
  onRetry,
  onDismiss,
  className,
}: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-sm shadow-2xs",
        className
      )}
    >
      <div className="flex items-start sm:items-center gap-3">
        <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
        <p className="font-medium leading-relaxed">{message}</p>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        {onRetry && (
          <Button
            size="sm"
            variant="destructive"
            onClick={onRetry}
            className="gap-1.5 h-8 text-xs font-semibold"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-8 text-xs text-rose-700 hover:bg-rose-100"
          >
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
