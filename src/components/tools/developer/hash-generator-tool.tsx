"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Copy,
  Check,
  Upload,
  FileCode,
  Trash2,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  computeAllHashes,
  computeHmac,
  SAMPLE_TEXT_HASH,
  type HashResultItem,
} from "@/lib/developer/hash-generator";
import { formatBytes } from "@/lib/workspace/file-validator";
import { cn } from "@/lib/utils";

export function HashGeneratorTool() {
  const [inputType, setInputType] = useState<"text" | "file">("text");
  const [textInput, setTextInput] = useState<string>(SAMPLE_TEXT_HASH);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);

  // Configuration options
  const [uppercase, setUppercase] = useState<boolean>(false);
  const [format, setFormat] = useState<"hex" | "base64">("hex");
  const [enableHmac, setEnableHmac] = useState<boolean>(false);
  const [hmacSecret, setHmacSecret] = useState<string>("my-secret-key");

  // Output hashes state
  const [hashes, setHashes] = useState<HashResultItem[]>([]);
  const [hmacSha256, setHmacSha256] = useState<string>("");
  const [hmacSha512, setHmacSha512] = useState<string>("");
  const [execTime, setExecTime] = useState<number>(0);

  // Verification state
  const [compareHash, setCompareHash] = useState<string>("");
  const [copiedAlgo, setCopiedAlgo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect to recompute hashes whenever input or options change
  useEffect(() => {
    let isCancelled = false;

    async function runComputation() {
      let data: Uint8Array;
      if (inputType === "file" && selectedFile) {
        data = selectedFile.bytes;
      } else {
        data = new TextEncoder().encode(textInput);
      }

      try {
        const result = await computeAllHashes(data, { uppercase, format });
        if (!isCancelled) {
          setHashes(result.hashes);
          setExecTime(result.executionTimeMs);
        }

        if (enableHmac && hmacSecret) {
          const [h256, h512] = await Promise.all([
            computeHmac(data, hmacSecret, "SHA-256", { uppercase, format }),
            computeHmac(data, hmacSecret, "SHA-512", { uppercase, format }),
          ]);
          if (!isCancelled) {
            setHmacSha256(h256);
            setHmacSha512(h512);
          }
        } else if (!isCancelled) {
          setHmacSha256("");
          setHmacSha512("");
        }
      } catch {
        // Fallback for empty or cancelled
      }
    }

    runComputation();

    return () => {
      isCancelled = true;
    };
  }, [inputType, textInput, selectedFile, uppercase, format, enableHmac, hmacSecret]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAlgo(key);
      setTimeout(() => setCopiedAlgo(null), 1500);
    } catch {
      // Fallback
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        setSelectedFile({
          name: file.name,
          size: file.size,
          bytes: new Uint8Array(buffer),
        });
        setInputType("file");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleClear = () => {
    setTextInput("");
    setSelectedFile(null);
    setCompareHash("");
  };

  // Compare inspection
  const matchResult = (() => {
    const target = compareHash.trim().toLowerCase();
    if (!target) return null;

    for (const item of hashes) {
      if (item.hash.toLowerCase() === target) {
        return { matched: true, algorithm: item.algorithm };
      }
    }

    if (enableHmac) {
      if (hmacSha256.toLowerCase() === target) return { matched: true, algorithm: "HMAC-SHA256" };
      if (hmacSha512.toLowerCase() === target) return { matched: true, algorithm: "HMAC-SHA512" };
    }

    return { matched: false };
  })();

  return (
    <div className="w-full space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
        {/* Left: Input Type Switcher */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setInputType("text")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              inputType === "text"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            Text Input
          </button>
          <button
            type="button"
            onClick={() => setInputType("file")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              inputType === "file"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            File Checksum
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {inputType === "text" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTextInput(SAMPLE_TEXT_HASH)}
              className="text-xs gap-1.5 h-8 bg-white"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              Sample Text
            </Button>
          )}

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

          {(textInput || selectedFile) && (
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
      </div>

      {/* Options Bar */}
      <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs">
        <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">Options:</span>

        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={uppercase}
            onChange={(e) => setUppercase(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
          />
          <span className="text-slate-700 font-medium">Uppercase Hex</span>
        </label>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Encoding:</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "hex" | "base64")}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="hex">Hexadecimal</option>
            <option value="base64">Base64</option>
          </select>
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer select-none ml-auto">
          <input
            type="checkbox"
            checked={enableHmac}
            onChange={(e) => setEnableHmac(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
          />
          <span className="text-slate-700 font-medium">Enable HMAC (Keyed Hash)</span>
        </label>
      </div>

      {/* HMAC Secret Key Field (if enabled) */}
      {enableHmac && (
        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <label htmlFor="hmac-key" className="font-semibold text-amber-900 flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5 text-amber-700" />
              HMAC Secret Key
            </label>
            <span className="text-[11px] text-amber-700">Used to sign HMAC-SHA256 &amp; HMAC-SHA512</span>
          </div>
          <input
            id="hmac-key"
            type="text"
            value={hmacSecret}
            onChange={(e) => setHmacSecret(e.target.value)}
            placeholder="Enter secret key..."
            className="w-full px-3 py-1.5 font-mono text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-amber-500"
          />
        </div>
      )}

      {/* Input Section: Text or File Dropzone */}
      {inputType === "text" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="hash-text-input" className="text-sm font-semibold text-slate-900">
              Input String
            </label>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>{textInput.length} characters</span>
              <span>•</span>
              <span>{new TextEncoder().encode(textInput).length} bytes</span>
            </div>
          </div>

          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <textarea
              id="hash-text-input"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter or paste text to compute cryptographic hashes..."
              rows={4}
              spellCheck={false}
              className="w-full resize-y rounded-2xl p-3.5 font-mono text-xs text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-900">
            Selected File for In-Browser Checksum
          </label>

          {selectedFile ? (
            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileCode className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-slate-900">{selectedFile.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {formatBytes(selectedFile.size)} • Read directly in browser memory
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs bg-white"
              >
                Change File
              </Button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/70 hover:bg-slate-50 text-center cursor-pointer transition-colors space-y-2"
            >
              <Upload className="h-8 w-8 text-slate-400 mx-auto" />
              <div className="font-semibold text-xs text-slate-700">
                Click to choose any file or drag and drop
              </div>
              <p className="text-[11px] text-slate-500">
                Calculates cryptographic checksums client-side without uploading to any server.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hashes Output List */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs space-y-0">
        <div className="flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-xs text-slate-900">
              Computed Cryptographic Digests
            </span>
          </div>

          {execTime > 0 && (
            <span className="text-[11px] text-slate-400 font-mono">
              Computed in {execTime}ms via Web Crypto
            </span>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {hashes.map((item) => (
            <div
              key={item.algorithm}
              className="p-3.5 px-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 w-32 shrink-0">
                <span className="font-semibold text-xs text-slate-900">{item.algorithm}</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-slate-50 text-slate-500 font-mono">
                  {item.bits}b
                </Badge>
              </div>

              <div className="flex-1 font-mono text-xs text-slate-800 break-all select-all">
                {item.hash}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(item.hash, item.algorithm)}
                className="h-7 text-xs gap-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 shrink-0 self-end sm:self-auto"
                title={`Copy ${item.algorithm} hash`}
              >
                {copiedAlgo === item.algorithm ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy
                  </>
                )}
              </Button>
            </div>
          ))}

          {/* HMAC Hashes if enabled */}
          {enableHmac && hmacSha256 && (
            <>
              <div className="p-3.5 px-4 bg-amber-50/40 hover:bg-amber-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 w-32 shrink-0">
                  <span className="font-semibold text-xs text-amber-900">HMAC-SHA256</span>
                </div>
                <div className="flex-1 font-mono text-xs text-slate-800 break-all select-all">
                  {hmacSha256}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(hmacSha256, "hmac256")}
                  className="h-7 text-xs gap-1 text-slate-500 hover:text-amber-700 hover:bg-amber-100/50 shrink-0 self-end sm:self-auto"
                >
                  {copiedAlgo === "hmac256" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>

              <div className="p-3.5 px-4 bg-amber-50/40 hover:bg-amber-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 w-32 shrink-0">
                  <span className="font-semibold text-xs text-amber-900">HMAC-SHA512</span>
                </div>
                <div className="flex-1 font-mono text-xs text-slate-800 break-all select-all">
                  {hmacSha512}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(hmacSha512, "hmac512")}
                  className="h-7 text-xs gap-1 text-slate-500 hover:text-amber-700 hover:bg-amber-100/50 shrink-0 self-end sm:self-auto"
                >
                  {copiedAlgo === "hmac512" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hash Verification / Comparator Drawer */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-600" />
          <h4 className="font-semibold text-xs text-slate-900">
            Hash Comparator &amp; Checksum Verifier
          </h4>
        </div>
        <p className="text-xs text-slate-500">
          Paste an expected hash (e.g. SHA-256 from an official release page) to check if it matches the current input.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={compareHash}
            onChange={(e) => setCompareHash(e.target.value)}
            placeholder="Paste expected hash to compare..."
            className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
          />
          {compareHash && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCompareHash("")}
              className="text-xs h-9"
            >
              Clear
            </Button>
          )}
        </div>

        {matchResult && (
          <div
            className={cn(
              "p-3 rounded-xl border text-xs flex items-center gap-2.5",
              matchResult.matched
                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                : "bg-rose-50 border-rose-200 text-rose-950"
            )}
          >
            {matchResult.matched ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">
                  Match Verified! The input matches the {matchResult.algorithm} hash.
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span className="font-semibold">
                  No match found. The expected hash does not match any computed algorithm.
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
