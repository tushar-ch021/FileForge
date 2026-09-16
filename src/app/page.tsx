import React from "react";
import {
  ShieldCheck,
  Zap,
  Lock,
  Sparkles,
  Layers,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import { ToolsExplorer } from "@/components/tools/tools-explorer";
import { Card } from "@/components/ui/card";
import { SITE_CONFIG } from "@/lib/constants";

export default function HomePage() {
  const homeFaqs = [
    {
      question: "Are my files uploaded to your servers?",
      answer:
        "No. FileForge executes all PDF, Image, and Developer operations directly in your browser's local sandbox using WebAssembly, Web Crypto, and the HTML5 Canvas API. Your files never touch our servers or any cloud database.",
    },
    {
      question: "Is FileForge completely free to use?",
      answer:
        "Yes, 100% free. There are no subscriptions, no credit card requirements, no hidden fees, and no daily usage caps.",
    },
    {
      question: "Are there any file size limits?",
      answer:
        "Because operations run client-side, the only constraint is your computer or mobile device's available RAM memory. You can process large files without artificial server upload limits.",
    },
    {
      question: "Can I use FileForge offline?",
      answer:
        "Yes. Once the page is loaded in your browser, the client-side scripts continue to function even without an active internet connection.",
    },
  ];

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: SITE_CONFIG.description,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_CONFIG.url}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-linear-to-b from-slate-50/80 to-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Privacy Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800 mb-6 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>100% In-Browser Processing • Zero Server Uploads</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.15]">
            Fast, Private, In-Browser <br />
            <span className="text-blue-600">File & Developer Tools</span>
          </h1>

          <p className="mt-5 text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            A production-ready collection of 26 free utilities for PDF editing,
            image conversion, and developer tasks. Your files never leave your device.
          </p>

          {/* Quick Value Metrics */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm font-semibold text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>No Registration Required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>No Subscription or Paywalls</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Unlimited Client-Side Usage</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Interactive Explorer Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ToolsExplorer />
      </section>

      {/* Value Proposition / Trust Pillars */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Why Professionals Choose FileForge
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Built with modern web standards to deliver maximum security and zero friction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 bg-white space-y-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Zero Cloud Uploads
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Files are computed in your browser&apos;s private memory sandbox. Sensitive contracts, documents, and tokens never touch remote servers.
              </p>
            </Card>

            <Card className="p-6 bg-white space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Instant Processing
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Eliminate slow file uploads and download queues. Client-side WebAssembly processes gigabytes of documents instantaneously.
              </p>
            </Card>

            <Card className="p-6 bg-white space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Forever Free
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                No credit cards, no premium tiers, no watermarks, and no artificial daily limits. Every tool is unlocked for everyone.
              </p>
            </Card>

            <Card className="p-6 bg-white space-y-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/60">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                26 Specialized Tools
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                One unified bookmark for your daily workflow. Everything from PDF splitting to JWT inspection in a consistent, clean UI.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Global FAQ Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 text-blue-600 text-xs font-bold uppercase tracking-wider mb-2">
            <HelpCircle className="h-4 w-4" />
            <span>Common Questions</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Learn more about how our client-side architecture preserves privacy and speed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {homeFaqs.map((faq, idx) => (
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
    </div>
  );
}
