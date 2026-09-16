"use client";

import React, { useEffect } from "react";
import { ErrorState } from "@/components/feedback/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Uncaught application error:", error);
  }, [error]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex items-center justify-center">
      <ErrorState
        title="Application Exception"
        description="An unexpected error occurred in your browser session. No data was lost or transmitted externally."
        reset={reset}
      />
    </div>
  );
}
