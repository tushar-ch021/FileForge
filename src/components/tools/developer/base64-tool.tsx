"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Binary,
  ArrowRightLeft,
  Copy,
  Check,
  Download,
  Trash2,
  Upload,
  Sparkles,
  AlertCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  encodeBase64,
  decodeBase64,
  SAMPLE_TEXT_FOR_ENCODING,
  SAMPLE_BASE64_FOR_DECODING,
  type Base64ConversionResult,
} from "@/lib/developer/base64";
import { downloadText } from "@/lib/workspace/download";
import { formatBytes } from "@/lib/workspace/file-validator";
import { cn } from "@/lib/utils";

export function Base64Tool() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState<string>("");
  const [urlSafe, setUrlSafe] = useState<boolean>(false);
  const [stripPadding, setStripPadding] = useState<boolean>(false);
  const [lineWrap, setLineWrap] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Compute conversion result directly during render
  const conversion: Base64ConversionResult = useMemo(() => {
    if (!input) {
      return {
        success: true,
        result: "",
        stats: { inputChars: 0, inputBytes: 0, outputChars: 0, outputBytes: 0, sizeRatio: "0%" },
      };
    }

    if (mode === "encode") {
      return encodeBase64(input, { urlSafe, stripPadding, lineWrap });
    } else {
      return decodeBase64(input);
    }
  }, [input, mode, urlSafe, stripPadding, lineWrap]);

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
    const filename = mode === "encode" ? "encoded-base64.txt" : "decoded-text.txt";
    downloadText(conversion.result, filename, "text/plain;charset=utf-8");
  };

  const handleLoadSample = () => {
    if (mode === "encode") {
      setInput(SAMPLE_TEXT_FOR_ENCODING);
    } else {
      setInput(SAMPLE_BASE64_FOR_DECODING);
    }
  };

  const handleClear = () => {
    setInput("");
    textareaRef.current?.focus();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (mode === "encode") {
      // If user uploads a file to encode, read as data URL or array buffer
      const reader = new FileReader();
      if (file.type.startsWith("text/") || file.name.endsWith(".json") || file.name.endsWith(".js") || file.name.endsWith(".txt")) {
        reader.onload = (event) => {
          const content = event.target?.result;
          if (typeof content === "string") {
            setInput(content);
          }
        };
        reader.readAsText(file);
      } else {
        // Binary file (e.g. image, pdf) -> read as Data URL and extract base64
        reader.onload = (event) => {
          const content = event.target?.result;
          if (typeof content === "string") {
            // content format: data:[<mediatype>][;base64],<data>
            const commaIndex = content.indexOf(",");
            if (commaIndex !== -1) {
              setInput(content.slice(commaIndex + 1));
              setMode("decode"); // Set to decode so they can inspect or keep it
            } else {
              setInput(content);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    } else {
      // In decode mode, read text file
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result;
        if (typeof content === "string") {
          setInput(content);
        }
      };
      reader.readAsText(file);
    }

    e.target.value = "";
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
        {/* Left: Mode Switcher */}
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
            Text → Base64 (Encode)
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
            Base64 → Text (Decode)
          </button>
        </div>

        {/* Center/Right: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadSample}
            className="text-xs gap-1.5 h-8 bg-white"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            Sample
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs gap-1.5 h-8 bg-white"
          >
            <Upload className="h-3.5 w-3.5 text-slate-600" />
            Upload File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
          />

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

      {/* Options Bar (Only visible in Encode mode) */}
      {mode === "encode" && (
        <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">Options:</span>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={urlSafe}
              onChange={(e) => setUrlSafe(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span className="text-slate-700 font-medium">URL-Safe Base64 (replace +/ with -_)</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={stripPadding}
              onChange={(e) => setStripPadding(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span className="text-slate-700 font-medium">Strip Padding (=)</span>
          </label>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-slate-500">Line Wrap:</span>
            <select
              value={lineWrap}
              onChange={(e) => setLineWrap(parseInt(e.target.value, 10))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="0">None</option>
              <option value="64">64 chars</option>
              <option value="76">76 chars (MIME)</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Grid: Split Input & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Column */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="base64-input" className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-blue-600" />
              {mode === "encode" ? "Plain Text (Input)" : "Base64 String (Input)"}
            </label>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{conversion.stats.inputChars} chars</span>
              <span>•</span>
              <span>{formatBytes(conversion.stats.inputBytes)}</span>
            </div>
          </div>

          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <textarea
              id="base64-input"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                mode === "encode"
                  ? "Enter or paste text to encode into Base64 (supports UTF-8 & emojis)..."
                  : "Enter or paste Base64 string to decode into readable text..."
              }
              rows={13}
              spellCheck={false}
              className="w-full resize-y rounded-2xl p-3.5 font-mono text-xs text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Output Column */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="base64-output" className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Binary className="h-4 w-4 text-emerald-600" />
              {mode === "encode" ? "Base64 Output" : "Decoded Text Output"}
            </label>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {conversion.result && (
                <>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-600">
                    Ratio: {conversion.stats.sizeRatio}
                  </Badge>
                  <span>{conversion.stats.outputChars} chars</span>
                  <span>•</span>
                  <span>{formatBytes(conversion.stats.outputBytes)}</span>
                </>
              )}
            </div>
          </div>

          <div className="relative rounded-2xl border border-slate-200 bg-slate-50/50 shadow-xs min-h-[280px] flex flex-col">
            {conversion.error ? (
              <div className="p-4 m-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5 text-xs">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">Decoding Error</div>
                  <p className="text-rose-700">{conversion.error}</p>
                </div>
              </div>
            ) : (
              <textarea
                id="base64-output"
                readOnly
                value={conversion.result}
                placeholder="Converted output will appear here in real-time..."
                rows={13}
                spellCheck={false}
                className="w-full flex-1 resize-y rounded-2xl p-3.5 font-mono text-xs text-slate-900 leading-relaxed placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
            )}

            {/* Bottom Actions for Output */}
            {conversion.result && !conversion.error && (
              <div className="flex items-center justify-between p-3 border-t border-slate-200/80 bg-white/70 rounded-b-2xl">
                <span className="text-[11px] text-slate-500">
                  Ready to copy or export
                </span>
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
    </div>
  );
}
