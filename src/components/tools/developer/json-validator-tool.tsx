"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
  Download,
  Trash2,
  Upload,
  FileCode,
  Layers,
  FileJson,
  Hash,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  validateJsonDetail,
  getFormattedPreview,
  DetailedValidationResult,
  SAMPLE_VALID_OBJECT,
  SAMPLE_VALID_ARRAY,
  SAMPLE_INVALID_JSON,
} from "@/lib/developer/json-validator";
import { JsonIndent } from "@/lib/developer/json-formatter";
import { downloadText } from "@/lib/workspace/download";
import { formatBytes } from "@/lib/workspace/file-validator";
import { cn } from "@/lib/utils";

export function JsonValidatorTool() {
  const [input, setInput] = useState<string>("");
  const [indent, setIndent] = useState<JsonIndent>(2);
  const [sortKeys, setSortKeys] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"input" | "preview">("input");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Validate JSON whenever input changes (derived state via useMemo)
  const validationResult: DetailedValidationResult = useMemo(() => {
    return validateJsonDetail(input);
  }, [input]);

  // Formatted preview for valid JSON
  const formattedPreview: string = useMemo(() => {
    if (!validationResult.isValid) return "";
    return getFormattedPreview(input, indent, sortKeys);
  }, [input, validationResult.isValid, indent, sortKeys]);

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

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + tabInsert.length;
      }, 0);
    }
  };

  // Quick sample loaders
  const handleLoadSample = (sample: string) => {
    setUploadError(null);
    setInput(sample);
    setActiveTab("preview");
  };

  // Clear all
  const handleClear = () => {
    setInput("");
    setUploadError(null);
    textareaRef.current?.focus();
  };

  // Copy to clipboard
  const handleCopy = async () => {
    const textToCopy = formattedPreview || input;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Download valid or formatted JSON
  const handleDownload = () => {
    const content = formattedPreview || input;
    if (!content) return;
    downloadText(content, "validated.json", "application/json;charset=utf-8");
  };

  // Upload .json file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate extension
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      setUploadError(`File "${file.name}" is not a valid JSON file. Please choose a file with .json extension.`);
      e.target.value = "";
      return;
    }

    // Check empty file
    if (file.size === 0) {
      setUploadError(`File "${file.name}" is empty (0 bytes).`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setInput(content);
        setActiveTab("preview");
      }
    };
    reader.onerror = () => {
      setUploadError(`Failed to read file "${file.name}".`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Beautify in-place: updates input with formatted code
  const handleBeautifyInPlace = useCallback(() => {
    if (!validationResult.isValid) return;
    setInput(formattedPreview);
  }, [validationResult.isValid, formattedPreview]);

  // Keyboard shortcut: Cmd/Ctrl + Enter to beautify in place
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleBeautifyInPlace();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBeautifyInPlace]);

  return (
    <div className="w-full space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
        {/* Left: Quick Actions & Samples */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleLoadSample(SAMPLE_VALID_OBJECT)}
            className="text-xs gap-1.5 h-8 bg-white"
          >
            <FileCode className="h-3.5 w-3.5 text-blue-600" />
            Sample Object
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleLoadSample(SAMPLE_VALID_ARRAY)}
            className="text-xs gap-1.5 h-8 bg-white"
          >
            <Layers className="h-3.5 w-3.5 text-emerald-600" />
            Sample Array
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleLoadSample(SAMPLE_INVALID_JSON)}
            className="text-xs gap-1.5 h-8 bg-white text-slate-700"
          >
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            Sample Invalid
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs gap-1.5 h-8 bg-white"
          >
            <Upload className="h-3.5 w-3.5 text-slate-600" />
            Upload .json
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

        {/* Right: Indent & Sort options */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-xl">
            <span className="text-slate-500 font-medium hidden sm:inline">Preview Indent:</span>
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

      {/* File Upload Error Notice */}
      {uploadError && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-700 bg-rose-50 rounded-xl border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

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
          JSON Input {validationResult.stats.lineCount > 0 && `(${validationResult.stats.lineCount} lines)`}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
            activeTab === "preview"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          Validation Status & Preview
        </button>
      </div>

      {/* Main Validation Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Pane: Input Editor */}
        <div
          className={cn(
            "flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs",
            activeTab === "preview" ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                JSON Source
              </span>
              {input && (
                <span className="font-mono text-slate-500">
                  {validationResult.stats.lineCount} lines • {formatBytes(validationResult.stats.byteSize)}
                </span>
              )}
            </div>

            {input.trim() ? (
              <Badge
                variant={validationResult.isValid ? "success" : "destructive"}
                className="text-[10px] py-0 px-2 font-semibold"
              >
                {validationResult.isValid ? "Valid JSON" : "Invalid JSON"}
              </Badge>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">Ready</span>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDownTextarea}
            placeholder='Paste JSON code or upload a .json file to validate syntax...'
            spellCheck={false}
            className="w-full h-80 sm:h-96 p-4 font-mono text-xs sm:text-sm text-slate-900 bg-white resize-none focus:outline-none placeholder:text-slate-400 leading-relaxed"
          />
        </div>

        {/* Right Pane: Validation Status & Pretty Preview */}
        <div
          className={cn(
            "flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs",
            activeTab === "input" ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50/80 border-b border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Validation & Preview
              </span>
              {validationResult.isValid && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 uppercase font-mono text-blue-700 bg-blue-50 border-blue-200">
                  Type: {validationResult.type}
                </Badge>
              )}
            </div>

            {/* Actions on valid preview */}
            {validationResult.isValid && (
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

          {/* Validation Result Content */}
          {input.trim() ? (
            validationResult.isValid ? (
              <div className="flex flex-col h-80 sm:h-96">
                {/* Structural Summary Chips */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-emerald-50/40 border-b border-emerald-100 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Valid JSON ({validationResult.type})
                  </span>
                  {validationResult.itemCount !== undefined && (
                    <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-slate-700 font-mono text-[11px]">
                      <Hash className="h-3 w-3 text-slate-400" />
                      {validationResult.itemCount} {validationResult.type === "array" ? "items" : "keys"}
                    </span>
                  )}
                  {validationResult.depth !== undefined && (
                    <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-slate-700 font-mono text-[11px]">
                      <Layers className="h-3 w-3 text-slate-400" />
                      Depth: {validationResult.depth}
                    </span>
                  )}
                </div>

                {/* Pretty-Printed Preview Area */}
                <textarea
                  readOnly
                  value={formattedPreview}
                  spellCheck={false}
                  className="w-full flex-1 p-4 font-mono text-xs sm:text-sm text-slate-900 bg-slate-50/40 resize-none focus:outline-none leading-relaxed select-all"
                />
              </div>
            ) : (
              /* Invalid JSON Diagnostic View */
              <div className="flex flex-col justify-center h-80 sm:h-96 p-6 bg-rose-50/30 space-y-4">
                <div className="flex items-center gap-2 text-rose-700">
                  <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-rose-900">
                      Invalid JSON Syntax
                    </h4>
                    {validationResult.error?.line !== undefined ? (
                      <p className="text-xs text-rose-700 font-medium">
                        Error detected at Line {validationResult.error.line}, Column {validationResult.error.column}
                      </p>
                    ) : (
                      <p className="text-xs text-rose-700 font-medium">
                        Parser caught a structural anomaly
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-rose-200 text-xs font-mono text-rose-800 leading-relaxed shadow-2xs">
                  {validationResult.error?.message}
                </div>

                <p className="text-xs text-slate-500">
                  Tip: Verify quotation marks, missing or trailing commas, and matching braces/brackets.
                </p>
              </div>
            )
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-80 sm:h-96 p-6 text-center bg-slate-50/30 text-slate-400 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-300">
                <FileJson className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                Validation status and preview will appear here
              </p>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Paste JSON on the left or load a sample to inspect syntax errors and JSON types.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            size="lg"
            onClick={handleBeautifyInPlace}
            disabled={!validationResult.isValid}
            className="gap-2 shadow-xs"
          >
            <Sparkles className="h-4 w-4" />
            Beautify in Editor
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-blue-700/80 text-blue-100 rounded">
              ⌘ Enter
            </kbd>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleCopy}
            disabled={!input.trim()}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy JSON"}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Validated 100% locally in your browser</span>
        </div>
      </div>
    </div>
  );
}
