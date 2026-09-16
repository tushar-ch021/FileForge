"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Sparkles,
  Minimize2,
  Copy,
  Check,
  Download,
  Trash2,
  Upload,
  FileCode,
  AlertCircle,
  CheckCircle2,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatJson,
  minifyJson,
  validateJson,
  calculateJsonStats,
  SAMPLE_JSON,
  JsonIndent,
  JsonStats,
} from "@/lib/developer/json-formatter";
import { downloadText } from "@/lib/workspace/download";
import { formatBytes } from "@/lib/workspace/file-validator";
import { cn } from "@/lib/utils";

export function JsonFormatterTool() {
  const [input, setInput] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [indent, setIndent] = useState<JsonIndent>(2);
  const [sortKeys, setSortKeys] = useState<boolean>(false);
  const [error, setError] = useState<{ message: string; line?: number; column?: number } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [outputStats, setOutputStats] = useState<JsonStats>({ lineCount: 0, charCount: 0, byteSize: 0, type: "empty" });
  const [activeTab, setActiveTab] = useState<"input" | "output">("input");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Derive input stats directly during render
  const inputStats = useMemo(() => calculateJsonStats(input), [input]);

  // Handle format action
  const handleFormat = useCallback(() => {
    if (!input.trim()) {
      setError({ message: "Please enter or paste JSON to format." });
      return;
    }

    try {
      const { formatted, stats } = formatJson(input, { indent, sortKeys });
      setOutput(formatted);
      setOutputStats(stats);
      setError(null);
      setActiveTab("output");
    } catch (err) {
      const validation = validateJson(input);
      setError(validation.error || { message: err instanceof Error ? err.message : "Failed to format JSON." });
    }
  }, [input, indent, sortKeys]);

  // Handle minify action
  const handleMinify = useCallback(() => {
    if (!input.trim()) {
      setError({ message: "Please enter or paste JSON to minify." });
      return;
    }

    try {
      const { minified, stats } = minifyJson(input);
      setOutput(minified);
      setOutputStats(stats);
      setError(null);
      setActiveTab("output");
    } catch (err) {
      const validation = validateJson(input);
      setError(validation.error || { message: err instanceof Error ? err.message : "Failed to minify JSON." });
    }
  }, [input]);

  // Handle validate action
  const handleValidate = useCallback(() => {
    if (!input.trim()) {
      setError({ message: "Please enter or paste JSON to validate." });
      return;
    }

    const validation = validateJson(input);
    if (validation.isValid) {
      setError(null);
    } else {
      setError(validation.error || { message: "Invalid JSON syntax." });
    }
  }, [input]);

  // Keyboard shortcut: Cmd/Ctrl + Enter to format
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleFormat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFormat]);

  // Handle Tab key inside input textarea
  const handleKeyDownTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const tabInsert = indent === "tab" ? "\t" : " ".repeat(indent);

      const newVal = val.substring(0, start) + tabInsert + val.substring(end);
      setInput(newVal);

      // Restore cursor position
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + tabInsert.length;
      }, 0);
    }
  };

  // Load sample JSON
  const handleLoadSample = () => {
    setInput(SAMPLE_JSON);
    setError(null);
    const { formatted, stats } = formatJson(SAMPLE_JSON, { indent: 2 });
    setOutput(formatted);
    setOutputStats(stats);
  };

  // Clear all
  const handleClear = () => {
    setInput("");
    setOutput("");
    setError(null);
    setOutputStats({ lineCount: 0, charCount: 0, byteSize: 0, type: "empty" });
    textareaRef.current?.focus();
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = output;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Download .json
  const handleDownload = () => {
    if (!output) return;
    downloadText(output, "formatted.json", "application/json;charset=utf-8");
  };

  // Upload .json file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setInput(content);
        setError(null);
        try {
          const { formatted, stats } = formatJson(content, { indent, sortKeys });
          setOutput(formatted);
          setOutputStats(stats);
        } catch {
          // If formatting fails on initial upload, keep raw text and let user inspect error
          const validation = validateJson(content);
          setError(validation.error || { message: "Uploaded file contains invalid JSON." });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input
  };

  return (
    <div className="w-full space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
        {/* Left: Input Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadSample}
            className="text-xs gap-1.5 h-8 bg-white"
          >
            <FileCode className="h-3.5 w-3.5 text-blue-600" />
            Load Sample
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
            accept=".json,application/json,text/plain"
            onChange={handleFileUpload}
            className="hidden"
          />

          {input && (
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
          )}
        </div>

        {/* Right: Formatting Options */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-xl">
            <span className="text-slate-500 font-medium hidden sm:inline">Indent:</span>
            <select
              value={indent}
              onChange={(e) => {
                const val = e.target.value === "tab" ? "tab" : (parseInt(e.target.value, 10) as 2 | 4);
                setIndent(val);
              }}
              className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="2">2 Spaces</option>
              <option value="4">4 Spaces</option>
              <option value="tab">Tab</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-xl cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sortKeys}
              onChange={(e) => setSortKeys(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span className="text-slate-700 font-medium">Sort Keys</span>
          </label>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="flex lg:hidden rounded-xl bg-slate-100 p-1 border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("input")}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
            activeTab === "input"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          Raw Input {inputStats.lineCount > 0 && `(${inputStats.lineCount} lines)`}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("output")}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
            activeTab === "output"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          Formatted Output {outputStats.lineCount > 0 && `(${outputStats.lineCount} lines)`}
        </button>
      </div>

      {/* Editor Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Pane: Input */}
        <div
          className={cn(
            "flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs",
            activeTab === "output" ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Input JSON
              </span>
              {input && (
                <span className="font-mono text-slate-500">
                  {inputStats.lineCount} lines • {formatBytes(inputStats.byteSize)}
                </span>
              )}
            </div>

            {input.trim() && (
              <Badge variant={error ? "destructive" : "success"} className="text-[10px] py-0 px-2">
                {error ? "Syntax Error" : "Valid JSON"}
              </Badge>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDownTextarea}
            placeholder='Paste, type, or drop raw JSON here (e.g. {"status": 200, "data": []})...'
            spellCheck={false}
            className="w-full h-80 sm:h-96 p-4 font-mono text-xs sm:text-sm text-slate-900 bg-white resize-none focus:outline-none placeholder:text-slate-400 leading-relaxed"
          />
        </div>

        {/* Right Pane: Formatted Output */}
        <div
          className={cn(
            "flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs",
            activeTab === "input" ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50/80 border-b border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Formatted Result
              </span>
              {output && (
                <span className="font-mono text-slate-500">
                  {outputStats.lineCount} lines • {formatBytes(outputStats.byteSize)}
                </span>
              )}
            </div>

            {/* Output Actions */}
            {output && (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 px-2.5 text-xs gap-1 bg-white font-medium"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-600" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleDownload}
                  className="h-7 px-2.5 text-xs gap-1 shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Save</span>
                </Button>
              </div>
            )}
          </div>

          {output ? (
            <textarea
              readOnly
              value={output}
              spellCheck={false}
              className="w-full h-80 sm:h-96 p-4 font-mono text-xs sm:text-sm text-slate-900 bg-slate-50/40 resize-none focus:outline-none leading-relaxed select-all"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-80 sm:h-96 p-6 text-center bg-slate-50/30 text-slate-400 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-300">
                <ArrowRightLeft className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                Formatted output will appear here
              </p>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Click <strong>Beautify JSON</strong> or <strong>Minify JSON</strong> below to process your data.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert Diagnostic */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-xs sm:text-sm">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-900">
              Syntax Error detected
              {error.line !== undefined && ` at Line ${error.line}`}
              {error.column !== undefined && `, Column ${error.column}`}
            </p>
            <p className="font-mono text-xs text-rose-700 leading-relaxed">
              {error.message}
            </p>
          </div>
        </div>
      )}

      {/* Primary Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            size="lg"
            onClick={handleFormat}
            className="gap-2 shadow-xs"
          >
            <Sparkles className="h-4 w-4" />
            Beautify JSON
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-blue-700/80 text-blue-100 rounded">
              ⌘ Enter
            </kbd>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleMinify}
            className="gap-2"
          >
            <Minimize2 className="h-4 w-4" />
            Minify JSON
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleValidate}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Validate
          </Button>
        </div>

        {/* Size comparison pill when output exists */}
        {output && inputStats.byteSize > 0 && (
          <div className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            {outputStats.byteSize < inputStats.byteSize ? (
              <span className="text-emerald-700 font-semibold">
                Saved {Math.round((1 - outputStats.byteSize / inputStats.byteSize) * 100)}% (
                {formatBytes(inputStats.byteSize - outputStats.byteSize)})
              </span>
            ) : (
              <span>Output size: {formatBytes(outputStats.byteSize)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
