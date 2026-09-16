import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Image as ImageIcon, ShieldCheck, ChevronRight } from "lucide-react";
import { getToolsByCategory } from "@/config/tools";
import { ToolCard } from "@/components/tools/tool-card";
import { constructMetadata, generateCategoryJsonLd } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "Free Image Tools — Compress, Convert, Resize & Crop Online",
  description:
    "A free suite of 7 client-side image tools. Optimize, resize, crop, convert formats, and strip EXIF metadata with high-fidelity algorithms and zero uploads.",
  canonicalUrl: "/image",
  keywords: [
    "image tools",
    "image compressor",
    "png to jpg",
    "convert image",
    "resize photo online",
    "remove background",
    "crop picture",
    "clean exif metadata",
  ],
});

export default function ImageHubPage() {
  const tools = getToolsByCategory("image");
  const jsonLd = generateCategoryJsonLd({
    categoryName: "Image Tools",
    categoryRoute: "/image",
    description:
      "Optimize, resize, crop, and convert image formats locally with high-fidelity algorithms.",
    tools,
  });

  return (
    <div className="min-h-screen bg-white pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Category Header */}
      <div className="border-b border-slate-200/80 bg-slate-50/60 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 mb-6">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-900 font-semibold">Image Tools</span>
          </nav>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 shadow-xs">
                <ImageIcon className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    Image Tools
                  </h1>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {tools.length} Tools
                  </span>
                </div>
                <p className="mt-1 text-sm sm:text-base text-slate-600 max-w-xl">
                  Optimize, resize, crop, and convert image formats locally with high-fidelity algorithms.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>100% In-Browser Privacy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  );
}
