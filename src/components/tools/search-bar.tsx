"use client";

import React, { useRef, useEffect } from "react";
import { Search, FileText, Image, Code2, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CategoryFilter = "all" | "pdf" | "image" | "developer";

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  counts: {
    all: number;
    pdf: number;
    image: number;
    developer: number;
  };
}

export function SearchBar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  counts,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input when pressing "/" or "Ctrl+K" / "Cmd+K"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const categories: {
    id: CategoryFilter;
    label: string;
    icon: React.ElementType;
    count: number;
  }[] = [
    { id: "all", label: "All Tools", icon: LayoutGrid, count: counts.all },
    { id: "pdf", label: "PDF Tools", icon: FileText, count: counts.pdf },
    { id: "image", label: "Image Tools", icon: Image, count: counts.image },
    { id: "developer", label: "Developer Tools", icon: Code2, count: counts.developer },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Search Input Box */}
      <div className="relative max-w-2xl mx-auto">
        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search all 26 free tools (e.g. compress pdf, jwt, base64, crop)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            icon={<Search className="h-4 w-4" />}
            clearable
            onClear={() => onSearchChange("")}
            className="h-12 text-base shadow-xs pl-10 pr-24 rounded-2xl border-slate-300 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 pointer-events-none">
            <kbd className="inline-flex h-6 items-center gap-0.5 rounded-md border border-slate-200 bg-slate-100 px-1.5 font-mono text-[11px] font-medium text-slate-500">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                isSelected
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              )}
            >
              <Icon className={cn("h-4 w-4", isSelected ? "text-white" : "text-slate-500")} />
              <span>{cat.label}</span>
              <span
                className={cn(
                  "text-[11px] px-1.5 py-0.2 rounded-full font-semibold",
                  isSelected
                    ? "bg-slate-800 text-slate-200"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
