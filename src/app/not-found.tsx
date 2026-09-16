import React from "react";
import Link from "next/link";
import { FileQuestion, Home, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOOLS } from "@/config/tools";

export default function NotFound() {
  const suggestedTools = TOOLS.slice(0, 4);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
      <div className="flex flex-col items-center justify-center">
        <div className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 border border-blue-200/60 shadow-xs">
          <FileQuestion className="h-8 w-8" />
        </div>

        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
          404 Error
        </span>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
          Tool or Page Not Found
        </h1>

        <p className="text-base text-slate-600 max-w-md mx-auto mb-8 leading-relaxed">
          The requested tool route does not exist or may have been relocated. All 26 free tools remain available on our homepage.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
          <Button asChild size="lg" className="gap-2 shadow-sm">
            <Link href="/">
              <Home className="h-4 w-4" />
              Return to Homepage
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/#main-content">
              <Search className="h-4 w-4" />
              Search All Tools
            </Link>
          </Button>
        </div>

        {/* Popular Tools Shortcuts */}
        <div className="w-full max-w-2xl border-t border-slate-200/80 pt-10 text-left">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 text-center">
            Popular Utilities You Might Need
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestedTools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.route}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-slate-50 transition-all group"
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {tool.shortDescription}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
