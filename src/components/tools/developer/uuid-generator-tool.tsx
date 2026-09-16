"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Fingerprint,
  RefreshCw,
  Copy,
  Check,
  Download,
  CheckCircle2,
  AlertTriangle,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  generateUuidBatch,
  validateUuid,
  type UuidVersion,
  type UuidFormatOptions,
  type UuidValidationInfo,
} from "@/lib/developer/uuid-generator";
import { downloadText } from "@/lib/workspace/download";
import { cn } from "@/lib/utils";

export function UuidGeneratorTool() {
  const [version, setVersion] = useState<UuidVersion>("v4");
  const [quantity, setQuantity] = useState<number>(5);
  const [uppercase, setUppercase] = useState<boolean>(false);
  const [hyphens, setHyphens] = useState<boolean>(true);
  const [braces, setBraces] = useState<boolean>(false);
  const [quotes, setQuotes] = useState<"none" | "double" | "single">("none");

  // Initial generated list
  const [uuids, setUuids] = useState<string[]>(() =>
    generateUuidBatch(5, "v4", { uppercase: false, hyphens: true, braces: false, quotes: "none" })
  );

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  // Inspector / Validator state
  const [inspectInput, setInspectInput] = useState<string>("");

  const formatOptions: UuidFormatOptions = useMemo(
    () => ({ uppercase, hyphens, braces, quotes }),
    [uppercase, hyphens, braces, quotes]
  );

  const handleGenerate = useCallback(() => {
    const list = generateUuidBatch(quantity, version, formatOptions);
    setUuids(list);
  }, [quantity, version, formatOptions]);

  const handleCopySingle = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // Fallback
    }
  };

  const handleCopyAll = async () => {
    const text = uuids.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadTxt = () => {
    const text = uuids.join("\n");
    downloadText(text, `uuids-${version}.txt`, "text/plain;charset=utf-8");
  };

  const handleDownloadJson = () => {
    const json = JSON.stringify(uuids, null, 2);
    downloadText(json, `uuids-${version}.json`, "application/json;charset=utf-8");
  };

  const validationInfo: UuidValidationInfo | null = useMemo(() => {
    if (!inspectInput.trim()) return null;
    return validateUuid(inspectInput);
  }, [inspectInput]);

  return (
    <div className="w-full space-y-6">
      {/* Top Configuration Bar */}
      <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-4">
        {/* Row 1: Version Selector & Quantity */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Version Selector */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setVersion("v4")}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                version === "v4"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              UUID v4 (Random)
            </button>

            <button
              type="button"
              onClick={() => setVersion("v7")}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                version === "v7"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              UUID v7 (Time-Ordered)
            </button>

            <button
              type="button"
              onClick={() => setVersion("nil")}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                version === "nil"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              NIL (All Zeros)
            </button>
          </div>

          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Quantity:</span>
            <div className="flex items-center gap-1">
              {[1, 5, 10, 50, 100].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setQuantity(num)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors border",
                    quantity === num
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {num}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={500}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setQuantity(Math.max(1, Math.min(val, 500)));
              }}
              className="w-16 h-8 text-center text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              aria-label="Custom quantity"
            />
          </div>
        </div>

        {/* Row 2: Formatting Options & Generate Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={uppercase}
                onChange={(e) => setUppercase(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              <span className="text-slate-700 font-medium">Uppercase</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hyphens}
                onChange={(e) => setHyphens(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              <span className="text-slate-700 font-medium">Include Hyphens</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={braces}
                onChange={(e) => setBraces(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              <span className="text-slate-700 font-medium">Braces &#123;...&#125;</span>
            </label>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Quotes:</span>
              <select
                value={quotes}
                onChange={(e) => setQuotes(e.target.value as "none" | "double" | "single")}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none cursor-pointer text-xs"
              >
                <option value="none">None</option>
                <option value="double">Double (&quot;...&quot;)</option>
                <option value="single">Single (&apos;...&apos;)</option>
              </select>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleGenerate}
            className="text-xs gap-1.5 h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Generate {quantity} UUID{quantity > 1 ? "s" : ""}
          </Button>
        </div>
      </div>

      {/* Generated Results Card */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
        {/* Results Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-xs text-slate-900">
              Generated Identifiers ({uuids.length})
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white uppercase">
              {version}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyAll}
              className="h-7 text-xs gap-1.5 bg-white"
            >
              {copiedAll ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" /> Copied All
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy All
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTxt}
              className="h-7 text-xs gap-1.5 bg-white"
            >
              <Download className="h-3 w-3" /> .TXT
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadJson}
              className="h-7 text-xs gap-1.5 bg-white"
            >
              <Download className="h-3 w-3" /> .JSON
            </Button>
          </div>
        </div>

        {/* UUID List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 font-mono text-xs">
          {uuids.map((id, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2.5 px-4 hover:bg-slate-50 transition-colors group"
            >
              <span className="text-slate-400 text-[11px] w-8">{index + 1}.</span>
              <span className="flex-1 font-medium text-slate-800 break-all select-all">
                {id}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCopySingle(id, index)}
                className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 shrink-0 ml-2"
                title="Copy this UUID"
              >
                {copiedIndex === index ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Built-in Quick UUID Validator Section */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-600" />
          <h4 className="font-semibold text-xs text-slate-900">
            UUID Inspector & Validator
          </h4>
        </div>
        <p className="text-xs text-slate-500">
          Paste any existing UUID to inspect RFC 4122 compliance, version number, and embedded timestamp.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={inspectInput}
            onChange={(e) => setInspectInput(e.target.value)}
            placeholder="Paste UUID to test (e.g. 123e4567-e89b-12d3-a456-426614174000)..."
            className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
          />
          {inspectInput && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setInspectInput("")}
              className="text-xs h-9"
            >
              Clear
            </Button>
          )}
        </div>

        {validationInfo && (
          <div
            className={cn(
              "p-3 rounded-xl border text-xs flex items-start gap-2.5",
              validationInfo.isValid
                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                : "bg-rose-50 border-rose-200 text-rose-950"
            )}
          >
            {validationInfo.isValid ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="font-semibold">
                {validationInfo.isValid ? "Valid RFC UUID" : "Invalid UUID"}
              </div>
              {validationInfo.isValid ? (
                <div className="text-[11px] text-emerald-800 space-y-0.5">
                  <p>
                    <strong>Version:</strong> {validationInfo.version === 0 ? "NIL (Empty)" : `Version ${validationInfo.version}`}
                  </p>
                  <p>
                    <strong>Variant:</strong> {validationInfo.variant}
                  </p>
                  {validationInfo.timestamp && (
                    <p>
                      <strong>Embedded Timestamp:</strong> {validationInfo.timestamp.toISOString()} ({validationInfo.timestamp.toLocaleString()})
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-rose-700">{validationInfo.error}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
