"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, FileText, Image as ImageIcon, Code2, ShieldCheck, ArrowRight } from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const handleClose = () => setIsOpen(false);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "FileText":
        return <FileText className="h-5 w-5 text-rose-500" />;
      case "Image":
        return <ImageIcon className="h-5 w-5 text-emerald-500" />;
      case "Code2":
        return <Code2 className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle navigation menu"
        className="rounded-xl border border-slate-200"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 top-16 z-40 bg-slate-900/30 backdrop-blur-xs transition-opacity"
          onClick={handleClose}
        />
      )}

      {/* Drawer Menu */}
      <div
        className={cn(
          "fixed left-0 right-0 top-16 z-50 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-slate-200 bg-white p-6 shadow-xl transition-all duration-200",
          isOpen ? "block translate-y-0 opacity-100" : "hidden -translate-y-2 opacity-0"
        )}
      >
        <div className="flex flex-col space-y-5">
          {/* Privacy Notice in Mobile Drawer */}
          <div className="flex items-center gap-2.5 rounded-xl bg-blue-50/70 p-3 text-xs text-blue-800 border border-blue-100">
            <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" />
            <span>All file tools execute 100% locally in your browser.</span>
          </div>

          <div className="space-y-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tool Suites
            </p>
            {NAV_LINKS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleClose}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3.5 py-3 text-base font-medium transition-colors",
                    isActive
                      ? "bg-slate-100 text-blue-600 font-semibold"
                      : "text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {getIcon(item.icon)}
                    <span>{item.label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <Link
              href="/"
              onClick={handleClose}
              className="flex items-center justify-between px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <span>Browse All 26 Tools</span>
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-md font-semibold text-slate-600">
                Free
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
