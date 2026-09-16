import * as React from "react";
import { SearchX, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = "No tools found",
  description = "We couldn't find any tools matching your search query. Try checking your spelling or selecting another category.",
  actionLabel = "Clear Filters",
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 md:p-16 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 max-w-md mx-auto my-8">
      <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-400 mb-4">
        <SearchX className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-sm">
        {description}
      </p>
      {onAction && (
        <Button onClick={onAction} variant="outline" size="sm" className="gap-2">
          <RefreshCcw className="h-3.5 w-3.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
