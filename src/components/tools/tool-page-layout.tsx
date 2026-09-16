import React from "react";
import Link from "next/link";
import {
  ChevronRight,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  UploadCloud,
  Sparkles,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import { ToolMetadata } from "@/types/tools";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolIcon } from "./tool-icon";
import { ToolCard } from "./tool-card";
import { generateToolJsonLd } from "@/lib/seo";
import { TOOLS } from "@/config/tools";

interface ToolPageLayoutProps {
  tool: ToolMetadata;
  children?: React.ReactNode;
}

const CATEGORY_NAMES = {
  pdf: "PDF Tools",
  image: "Image Tools",
  developer: "Developer Tools",
};

export function ToolPageLayout({ tool, children }: ToolPageLayoutProps) {
  const jsonLd = generateToolJsonLd(tool);
  const relatedTools = TOOLS.filter(
    (t) => t.category === tool.category && t.id !== tool.id
  ).slice(0, 3);

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top Breadcrumb & Trust Banner */}
      <div className="border-b border-slate-200/80 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <Link
              href={`/${tool.category}`}
              className="hover:text-slate-900 transition-colors font-medium capitalize"
            >
              {CATEGORY_NAMES[tool.category]}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-900 font-semibold">{tool.title}</span>
          </nav>

          {/* Privacy Signal */}
          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Files processed securely in your browser</span>
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8 text-center">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-50 border border-blue-200/60 text-blue-600 mb-4 shadow-2xs">
          <ToolIcon name={tool.iconName} className="h-8 w-8" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-3">
          <Badge variant="clientSide">
            <ShieldCheck className="h-3 w-3 mr-1" />
            100% Client-Side
          </Badge>
          {tool.badge && <Badge variant="popular">{tool.badge}</Badge>}
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          {tool.title}
        </h1>

        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {tool.fullDescription}
        </p>

        {/* Value pills */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-amber-500" /> Instant Processing
          </span>
          <span className="flex items-center gap-1">
            <Lock className="h-3.5 w-3.5 text-emerald-500" /> Zero Server Storage
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" /> Completely Free
          </span>
        </div>
      </div>

      {/* Main Interactive Tool Workspace Shell */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-10 shadow-sm transition-all">
          {children ? (
            children
          ) : (
            /* Placeholder Interactive Workspace */
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-10 sm:p-14 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
              <div className="h-16 w-16 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-blue-600 mb-4">
                <UploadCloud className="h-8 w-8" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {tool.title} Workspace
              </h3>

              <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
                Client-side processing engine is ready. Select your files or paste your input to get started immediately.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" className="shadow-sm gap-2">
                  <UploadCloud className="h-4 w-4" />
                  Choose File
                </Button>
                <Button variant="outline" size="lg">
                  Drop Files Here
                </Button>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Private & Secure: Files never leave your computer</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SEO & Guide Section: How to use, Features, FAQ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Step-by-step How-To Guide */}
        {tool.steps.length > 0 && (
          <section className="space-y-6">
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                How to Use {tool.title}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Follow these simple steps to process your files in seconds.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tool.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs relative"
                >
                  <div className="h-9 w-9 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm mb-4 shadow-xs">
                    {idx + 1}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Features Grid */}
        {tool.features.length > 0 && (
          <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Key Features & Performance
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tool.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-white p-4 rounded-xl border border-slate-200/80">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-slate-800">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Frequently Asked Questions */}
        {tool.faqs.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {tool.faqs.map((faq, idx) => (
                <Card key={idx} className="p-6">
                  <h3 className="text-base font-semibold text-slate-900 mb-2">
                    {faq.question}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {faq.answer}
                  </p>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Related Tools */}
        {relatedTools.length > 0 && (
          <section className="space-y-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  More {CATEGORY_NAMES[tool.category]}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Explore other fast, client-side tools in this category.
                </p>
              </div>
              <Button asChild variant="ghost">
                <Link href={`/${tool.category}`} className="gap-1 text-blue-600 font-semibold">
                  View All <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {relatedTools.map((relTool) => (
                <ToolCard key={relTool.id} tool={relTool} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
