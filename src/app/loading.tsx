import React from "react";
import { Skeleton, ToolGridSkeleton } from "@/components/feedback/loading-skeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* Hero skeleton */}
      <div className="space-y-4 max-w-2xl mx-auto text-center">
        <Skeleton className="h-6 w-48 mx-auto rounded-full" />
        <Skeleton className="h-12 w-3/4 mx-auto rounded-xl" />
        <Skeleton className="h-5 w-full mx-auto rounded-lg" />
      </div>

      {/* Search bar skeleton */}
      <div className="max-w-2xl mx-auto space-y-3">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="flex justify-center gap-2">
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      </div>

      {/* Tools grid skeleton */}
      <div className="pt-6">
        <ToolGridSkeleton count={6} />
      </div>
    </div>
  );
}
