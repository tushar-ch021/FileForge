import * as React from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error;
  reset?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred while processing your request. Your files remain completely secure on your machine.",
  reset,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-2xl border border-rose-200/80 bg-rose-50/40 max-w-lg mx-auto my-8">
      <div className="h-12 w-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 mb-4">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
        {description}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {reset && (
          <Button onClick={reset} variant="default" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/" className="gap-2">
            <Home className="h-4 w-4" />
            Return Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
