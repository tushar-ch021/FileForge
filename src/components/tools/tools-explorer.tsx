"use client";

import React, { useState, useMemo } from "react";
import { TOOLS } from "@/config/tools";
import { ToolCard } from "./tool-card";
import { SearchBar, CategoryFilter } from "./search-bar";
import { EmptyState } from "@/components/feedback/empty-state";
import { CATEGORIES } from "@/lib/constants";
import { CategoryCard } from "./category-card";

export function ToolsExplorer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");

  const counts = useMemo(() => {
    return {
      all: TOOLS.length,
      pdf: TOOLS.filter((t) => t.category === "pdf").length,
      image: TOOLS.filter((t) => t.category === "image").length,
      developer: TOOLS.filter((t) => t.category === "developer").length,
    };
  }, []);

  const filteredTools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return TOOLS.filter((tool) => {
      // Category filter
      if (selectedCategory !== "all" && tool.category !== selectedCategory) {
        return false;
      }

      // Query filter
      if (!q) return true;

      const titleMatch = tool.title.toLowerCase().includes(q);
      const descMatch = tool.shortDescription.toLowerCase().includes(q);
      const keywordMatch = tool.keywords.some((kw) => kw.toLowerCase().includes(q));

      return titleMatch || descMatch || keywordMatch;
    });
  }, [searchQuery, selectedCategory]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
  };

  return (
    <div className="space-y-12">
      {/* Search & Filter Bar */}
      <div className="pt-2">
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          counts={counts}
        />
      </div>

      {/* Category Overview Cards (Only shown when not searching and on 'all' view) */}
      {!searchQuery && selectedCategory === "all" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Top Categories
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              3 Specialized Suites
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CATEGORIES.map((cat) => {
              const popularInCat = TOOLS.filter((t) => t.category === cat.id)
                .slice(0, 3)
                .map((t) => t.title);

              return (
                <CategoryCard
                  key={cat.id}
                  id={cat.id as "pdf" | "image" | "developer"}
                  name={cat.name}
                  description={cat.description}
                  count={counts[cat.id as "pdf" | "image" | "developer"]}
                  route={cat.route}
                  popularTools={popularInCat}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tools Grid Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {searchQuery
                ? `Search Results (${filteredTools.length})`
                : selectedCategory === "all"
                ? "All Tools"
                : `${CATEGORIES.find((c) => c.id === selectedCategory)?.name || "Tools"} (${filteredTools.length})`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {searchQuery
                ? `Showing tools matching "${searchQuery}"`
                : "All tools run 100% locally on your device"}
            </p>
          </div>

          {(searchQuery || selectedCategory !== "all") && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline-offset-4 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No matching tools found"
            description={`No tools matched "${searchQuery}". Try a broader term like 'pdf', 'image', 'json', or reset the search.`}
            actionLabel="View All 26 Tools"
            onAction={handleClearFilters}
          />
        )}
      </div>
    </div>
  );
}
