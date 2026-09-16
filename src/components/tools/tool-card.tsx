import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { ToolMetadata } from "@/types/tools";
import { Badge } from "@/components/ui/badge";
import { ToolIcon } from "./tool-icon";
import { cn } from "@/lib/utils";

interface ToolCardProps {
  tool: ToolMetadata;
  className?: string;
}

const CATEGORY_STYLES = {
  pdf: {
    iconBg: "bg-rose-50 text-rose-600 border-rose-200/60",
    categoryLabel: "PDF Tool",
  },
  image: {
    iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
    categoryLabel: "Image Tool",
  },
  developer: {
    iconBg: "bg-blue-50 text-blue-600 border-blue-200/60",
    categoryLabel: "Developer Tool",
  },
};

export function ToolCard({ tool, className }: ToolCardProps) {
  const categoryConfig = CATEGORY_STYLES[tool.category] || CATEGORY_STYLES.developer;

  return (
    <Link
      href={tool.route}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none",
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105",
              categoryConfig.iconBg
            )}
          >
            <ToolIcon name={tool.iconName} className="h-5 w-5" />
          </div>

          <div className="flex items-center gap-1.5">
            {tool.badge && (
              <Badge
                variant={
                  tool.badge === "Popular"
                    ? "popular"
                    : tool.badge === "Client-Side"
                    ? "clientSide"
                    : tool.badge === "Essential"
                    ? "essential"
                    : "new"
                }
              >
                {tool.badge === "Client-Side" && (
                  <ShieldCheck className="h-3 w-3 inline mr-0.5" />
                )}
                {tool.badge}
              </Badge>
            )}
          </div>
        </div>

        <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1">
          {tool.title}
        </h3>

        <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-2">
          {tool.shortDescription}
        </p>
      </div>

      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="font-medium text-slate-400">
          {categoryConfig.categoryLabel}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-blue-600 transition-transform group-hover:translate-x-0.5">
          Open Tool
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
