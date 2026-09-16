"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Link2,
  ArrowRightLeft,
  Copy,
  Check,
  Download,
  Trash2,
  Sparkles,
  AlertCircle,
  Table,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  encodeUrl,
  decodeUrl,
  SAMPLE_URL_RAW,
  SAMPLE_URL_ENCODED,
  type UrlEncodeMode,
  type UrlConversionResult,
} from "@/lib/developer/url-encoder";
import { downloadText } from "@/lib/workspace/download";
import { cn } from "@/lib/utils";

export function UrlEncoderTool() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState<string>("");
  const [encodeMode, setEncodeMode] = useState<UrlEncodeMode>("component");
  const [rfc3986, setRfc3986] = useState<boolean>(false);
  const [spaceAsPlus, setSpaceAsPlus] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Compute conversion result directly during render
  const conversion: UrlConversionResult = useMemo(() => {
    if (!input) {
      return { success: true, result: "", charCount: 0, encodedCount: 0 };
    }

    if (mode === "encode") {
      return encodeUrl(input, { mode: encodeMode, rfc3986, spaceAsPlus });
    } else {
      return decodeUrl(input, { spaceAsPlus });
    }
  }, [input, mode, encodeMode, rfc3986, spaceAsPlus]);

  const handleSwap = () => {
    if (conversion.success && conversion.result) {
      setInput(conversion.result);
      setMode((prev) => (prev === "encode" ? "decode" : "encode"));
    }
  };

  const handleCopy = async () => {
    if (!conversion.result) return;
    try {
      await navigator.clipboard.writeText(conversion.result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = conversion.result;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!conversion.result) return;
    const filename = mode === "encode" ? "encoded-url.txt" : "decoded-url.txt";
    downloadText(conversion.result, filename, "text/plain;charset=utf-8");
  };

  const handleLoadSample = () => {
    if (mode === "encode") {
      setInput(SAMPLE_URL_RAW);
    } else {
      setInput(SAMPLE_URL_ENCODED);
    }
  };

  const handleClear = () => {
    setInput("");
    textareaRef.current?.focus();
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
        {/* Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMode("encode")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              mode === "encode"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            Encode URL
          </button>
          <button
            type="button"
            onClick={() => setMode("decode")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              mode === "decode"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            Decode URL
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadSample}
            className="text-xs gap-1.5 h-8 bg-white"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            Load Sample
          </Button>

          {input && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSwap}
                disabled={!conversion.result || !conversion.success}
                className="text-xs gap-1.5 h-8 bg-white"
                title="Swap input and output"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 text-slate-600" />
                <span className="hidden sm:inline">Swap</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs gap-1 h-8 text-slate-600 hover:text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Options Bar */}
      <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs">
        <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">Options:</span>

        {mode === "encode" && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Scope:</span>
            <select
              value={encodeMode}
              onChange={(e) => setEncodeMode(e.target.value as UrlEncodeMode)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="component">Component (encodeURIComponent)</option>
              <option value="full">Full URL (encodeURI)</option>
            </select>
          </div>
        )}

        {mode === "encode" && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rfc3986}
              onChange={(e) => setRfc3986(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span className="text-slate-700 font-medium">Strict RFC 3986 (!&apos;()*)</span>
          </label>
        )}

        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={spaceAsPlus}
            onChange={(e) => setSpaceAsPlus(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
          />
          <span className="text-slate-700 font-medium">Space as + (form-encoded)</span>
        </label>
      </div>

      {/* Main Grid: Split Input & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Column */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="url-input" className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Link2 className="h-4 w-4 text-blue-600" />
              {mode === "encode" ? "Raw URL / Text (Input)" : "Percent-Encoded URL (Input)"}
            </label>
            <span className="text-xs text-slate-500">{input.length} characters</span>
          </div>

          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <textarea
              id="url-input"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                mode === "encode"
                  ? "Enter or paste raw URL or parameter value to percent-encode..."
                  : "Enter or paste percent-encoded string to decode (e.g. https%3A%2F%2F...)..."
              }
              rows={12}
              spellCheck={false}
              className="w-full resize-y rounded-2xl p-3.5 font-mono text-xs text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Output Column */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="url-output" className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-emerald-600" />
              {mode === "encode" ? "Encoded Result" : "Decoded Result"}
            </label>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {conversion.result && (
                <>
                  {mode === "encode" && conversion.encodedCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700">
                      {conversion.encodedCount} sequences escaped
                    </Badge>
                  )}
                  <span>{conversion.charCount} characters</span>
                </>
              )}
            </div>
          </div>

          <div className="relative rounded-2xl border border-slate-200 bg-slate-50/50 shadow-xs min-h-[260px] flex flex-col">
            {conversion.error ? (
              <div className="p-4 m-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5 text-xs">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">URI Decoding Error</div>
                  <p className="text-rose-700 leading-relaxed">{conversion.error}</p>
                </div>
              </div>
            ) : (
              <textarea
                id="url-output"
                readOnly
                value={conversion.result}
                placeholder="Result will appear here in real-time..."
                rows={12}
                spellCheck={false}
                className="w-full flex-1 resize-y rounded-2xl p-3.5 font-mono text-xs text-slate-900 leading-relaxed placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
            )}

            {conversion.result && !conversion.error && (
              <div className="flex items-center justify-between p-3 border-t border-slate-200/80 bg-white/70 rounded-b-2xl">
                <span className="text-[11px] text-slate-500">Ready to copy</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="h-7 text-xs gap-1.5"
                  >
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Query Parameters Inspector Table */}
      {conversion.queryParams && conversion.queryParams.length > 0 && (
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs space-y-0">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Table className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-xs text-slate-900">
                Detected Query Parameters ({conversion.queryParams.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Auto-parsed parameter key-value pairs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 text-[11px]">
                  <th className="py-2.5 px-4 font-semibold w-1/4">Key</th>
                  <th className="py-2.5 px-4 font-semibold w-1/3">Raw / Encoded</th>
                  <th className="py-2.5 px-4 font-semibold">Decoded Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {conversion.queryParams.map((param, index) => (
                  <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 break-all">{param.key}</td>
                    <td className="py-2.5 px-4 text-slate-500 break-all">{param.rawValue}</td>
                    <td className="py-2.5 px-4 text-blue-600 font-medium break-all">{param.decodedValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
