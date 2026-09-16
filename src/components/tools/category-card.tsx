import React from "react";
import Link from "next/link";
import { ArrowRight, FileText, Image, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryCardProps {
  id: "pdf" | "image" | "developer";
  name: string;
  description: string;
  count: number;
  route: string;
  popularTools?: string[];
}

const CATEGORY_THEMES = {
  pdf: {
    icon: FileText,
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
    gradientBorder: "group-hover:border-rose-300",
    iconColor: "text-rose-600 bg-rose-50",
  },
  image: {
    icon: Image,
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    gradientBorder: "group-hover:border-emerald-300",
    iconColor: "text-emerald-600 bg-emerald-50",
  },
  developer: {
    icon: Code2,
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
    gradientBorder: "group-hover:border-blue-300",
    iconColor: "text-blue-600 bg-blue-50",
  },
};

export function CategoryCard({
  id,
  name,
  description,
  count,
  route,
  popularTools = [],
}: CategoryCardProps) {
  const theme = CATEGORY_THEMES[id] || CATEGORY_THEMES.developer;
  const IconComponent = theme.icon;

  return (
    <Link
      href={route}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
        theme.gradientBorder
      )}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 shadow-2xs transition-transform group-hover:scale-105",
              theme.iconColor
            )}
          >
            <IconComponent className="h-6 w-6" />
          </div>
          <span
            className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full border",
              theme.badgeBg
            )}
          >
            {count} Tools
          </span>
        </div>

        <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
          {name}
        </h3>

        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {description}
        </p>

        {popularTools.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {popularTools.map((tool) => (
              <span
                key={tool}
                className="text-xs bg-slate-50 text-slate-600 border border-slate-200/60 px-2 py-0.5 rounded-md font-medium"
              >
                {tool}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-semibold text-blue-600">
        <span>Browse All {name}</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
