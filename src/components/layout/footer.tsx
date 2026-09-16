import React from "react";
import Link from "next/link";
import { Layers, ShieldCheck, CheckCircle2 } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants";
import { TOOLS } from "@/config/tools";

export function Footer() {
  const pdfTools = TOOLS.filter((t) => t.category === "pdf").slice(0, 6);
  const imageTools = TOOLS.filter((t) => t.category === "image").slice(0, 6);
  const devTools = TOOLS.filter((t) => t.category === "developer").slice(0, 6);

  return (
    <footer className="w-full border-t border-slate-200/80 bg-slate-50/60 mt-20">
      {/* Privacy Guarantee Strip */}
      <div className="border-b border-slate-200/60 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/80">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Client-Side Privacy Guarantee
                </h4>
                <p className="text-xs text-slate-600">
                  {SITE_CONFIG.privacyPledge}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50/80 px-3 py-1.5 rounded-full border border-emerald-200/70">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All 26 Browser Tools Operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Layers className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold text-slate-900">
                {SITE_CONFIG.name}
              </span>
            </Link>
            <p className="text-sm text-slate-600 leading-relaxed max-w-sm">
              Free, fast, and secure in-browser utility suite. Convert, compress,
              and manipulate files locally with zero tracking and zero server storage.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-2">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                No Sign-up
              </span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                No Subscriptions
              </span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                100% Free
              </span>
            </div>
          </div>

          {/* PDF Tools Column */}
          <div className="space-y-3">
            <Link
              href="/pdf"
              className="text-xs font-bold uppercase tracking-wider text-slate-900 hover:text-blue-600 transition-colors"
            >
              PDF Tools
            </Link>
            <ul className="space-y-2 text-sm text-slate-600">
              {pdfTools.map((tool) => (
                <li key={tool.id}>
                  <Link
                    href={tool.route}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {tool.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/pdf"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  View All 9 PDF Tools &rarr;
                </Link>
              </li>
            </ul>
          </div>

          {/* Image Tools Column */}
          <div className="space-y-3">
            <Link
              href="/image"
              className="text-xs font-bold uppercase tracking-wider text-slate-900 hover:text-blue-600 transition-colors"
            >
              Image Tools
            </Link>
            <ul className="space-y-2 text-sm text-slate-600">
              {imageTools.map((tool) => (
                <li key={tool.id}>
                  <Link
                    href={tool.route}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {tool.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/image"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  View All 7 Image Tools &rarr;
                </Link>
              </li>
            </ul>
          </div>

          {/* Developer Tools Column */}
          <div className="space-y-3">
            <Link
              href="/developer"
              className="text-xs font-bold uppercase tracking-wider text-slate-900 hover:text-blue-600 transition-colors"
            >
              Developer Tools
            </Link>
            <ul className="space-y-2 text-sm text-slate-600">
              {devTools.map((tool) => (
                <li key={tool.id}>
                  <Link
                    href={tool.route}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {tool.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/developer"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  View All 10 Developer Tools &rarr;
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} {SITE_CONFIG.name}. Engineered for speed, security, and privacy.
          </p>
          <div className="flex items-center gap-6">
            <span>Built with client-side WebAssembly & Canvas</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
