"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Trash2,
  FileCode,
  ShieldCheck,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  decodeJwt,
  getSampleActiveJwt,
  getSampleExpiredJwt,
  type JwtDecodeResult,
} from "@/lib/developer/jwt-decoder";
import { cn } from "@/lib/utils";

export function JwtDecoderTool() {
  const [tokenInput, setTokenInput] = useState<string>("");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"payload" | "header" | "claims">("payload");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Derive decoded token state directly during render
  const decodeResult: JwtDecodeResult = useMemo(() => {
    if (!tokenInput.trim()) {
      return { isValid: false };
    }
    return decodeJwt(tokenInput);
  }, [tokenInput]);

  const handleCopy = async (text: string, sectionKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionKey);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedSection(sectionKey);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  const handleLoadSample = (type: "active" | "expired") => {
    const sample = type === "active" ? getSampleActiveJwt() : getSampleExpiredJwt();
    setTokenInput(sample);
  };

  const handleClear = () => {
    setTokenInput("");
    textareaRef.current?.focus();
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleLoadSample("active")}
            className="text-xs gap-1.5 h-8 bg-white"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            Load Active Sample
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleLoadSample("expired")}
            className="text-xs gap-1.5 h-8 bg-white text-slate-700"
          >
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            Load Expired Sample
          </Button>

          {tokenInput && (
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

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
            <ShieldCheck className="h-3 w-3" />
            100% In-Browser • Zero Server Calls
          </Badge>
        </div>
      </div>

      {/* Main Grid: Left Token Input, Right Decoded Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Token Input */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="jwt-input" className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-blue-600" />
              Encoded Token
            </label>
            <span className="text-xs text-slate-500">
              {tokenInput ? `${tokenInput.length} chars` : "Paste header, payload, or Bearer token"}
            </span>
          </div>

          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <textarea
              id="jwt-input"
              ref={textareaRef}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste your encoded JWT here (e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)"
              rows={14}
              spellCheck={false}
              className="w-full resize-y rounded-2xl p-3.5 font-mono text-xs text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          {/* Color-Coded Token Legend if token is split */}
          {decodeResult.isValid && decodeResult.rawHeader && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                Token Structure Breakdown
              </div>
              <div className="font-mono break-all text-[11px] leading-relaxed select-all">
                <span className="text-rose-600 font-medium bg-rose-50 px-1 py-0.5 rounded">
                  {decodeResult.rawHeader}
                </span>
                <span className="text-slate-400 font-bold">.</span>
                <span className="text-indigo-600 font-medium bg-indigo-50 px-1 py-0.5 rounded">
                  {decodeResult.rawPayload}
                </span>
                {decodeResult.rawSignature && (
                  <>
                    <span className="text-slate-400 font-bold">.</span>
                    <span className="text-cyan-700 font-medium bg-cyan-50 px-1 py-0.5 rounded">
                      {decodeResult.rawSignature}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Header
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" /> Payload
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-cyan-500" /> Signature
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Decoded View */}
        <div className="lg:col-span-7 space-y-4">
          {/* Validity / Status Banner */}
          {decodeResult.isValid && decodeResult.expirationInfo && (
            <div
              className={cn(
                "p-4 rounded-2xl border flex items-start gap-3 transition-all",
                decodeResult.expirationInfo.statusVariant === "active" &&
                  "bg-emerald-50/80 border-emerald-200 text-emerald-950",
                decodeResult.expirationInfo.statusVariant === "expired" &&
                  "bg-rose-50/80 border-rose-200 text-rose-950",
                decodeResult.expirationInfo.statusVariant === "not-yet-valid" &&
                  "bg-amber-50/80 border-amber-200 text-amber-950",
                decodeResult.expirationInfo.statusVariant === "no-expiry" &&
                  "bg-slate-100 border-slate-200 text-slate-900"
              )}
            >
              {decodeResult.expirationInfo.statusVariant === "active" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : decodeResult.expirationInfo.statusVariant === "expired" ? (
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    {decodeResult.expirationInfo.statusVariant === "active" && "Valid & Active Token"}
                    {decodeResult.expirationInfo.statusVariant === "expired" && "Token Has Expired"}
                    {decodeResult.expirationInfo.statusVariant === "not-yet-valid" && "Token Not Yet Valid"}
                    {decodeResult.expirationInfo.statusVariant === "no-expiry" && "No Expiry Specified"}
                  </span>
                  {decodeResult.header?.alg && (
                    <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0 bg-white">
                      {decodeResult.header.alg}
                    </Badge>
                  )}
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  {decodeResult.expirationInfo.statusMessage}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {decodeResult.error && tokenInput.trim() && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-sm">Invalid JWT Syntax</div>
                <p className="text-xs text-rose-700 leading-relaxed">{decodeResult.error}</p>
              </div>
            </div>
          )}

          {/* Empty State Prompt */}
          {!tokenInput.trim() && (
            <div className="p-10 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 flex flex-col items-center justify-center text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                <KeyRound className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-slate-800 text-sm">Awaiting JSON Web Token</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Paste an encoded token on the left or click &quot;Load Active Sample&quot; to inspect decoded claims, headers, and expiration dates.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleLoadSample("active")}
                className="text-xs gap-1.5 bg-white shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                Try with sample token
              </Button>
            </div>
          )}

          {/* Decoded Views & Tabs */}
          {decodeResult.isValid && (
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("payload")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                      activeTab === "payload"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Payload (Claims)
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("header")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                      activeTab === "header"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    Header
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("claims")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                      activeTab === "claims"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Info className="h-3.5 w-3.5" />
                    Standard Claims ({decodeResult.standardClaims?.length || 0})
                  </button>
                </div>

                {activeTab === "payload" && decodeResult.formattedPayload && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(decodeResult.formattedPayload!, "payload")}
                    className="h-7 text-xs gap-1"
                  >
                    {copiedSection === "payload" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy Payload
                      </>
                    )}
                  </Button>
                )}

                {activeTab === "header" && decodeResult.formattedHeader && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(decodeResult.formattedHeader!, "header")}
                    className="h-7 text-xs gap-1"
                  >
                    {copiedSection === "header" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy Header
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Tab 1: Payload (Claims) */}
              {activeTab === "payload" && (
                <div className="relative rounded-2xl border border-indigo-200/80 bg-indigo-50/30 p-4 font-mono text-xs text-slate-900 overflow-x-auto shadow-xs">
                  <pre className="leading-relaxed whitespace-pre-wrap break-all">
                    {decodeResult.formattedPayload}
                  </pre>
                </div>
              )}

              {/* Tab 2: Header */}
              {activeTab === "header" && (
                <div className="relative rounded-2xl border border-rose-200/80 bg-rose-50/30 p-4 font-mono text-xs text-slate-900 overflow-x-auto shadow-xs">
                  <pre className="leading-relaxed whitespace-pre-wrap break-all">
                    {decodeResult.formattedHeader}
                  </pre>
                </div>
              )}

              {/* Tab 3: Standard Claims Table */}
              {activeTab === "claims" && (
                <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                  {decodeResult.standardClaims && decodeResult.standardClaims.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {decodeResult.standardClaims.map((claim) => (
                        <div key={claim.key} className="p-3 sm:p-4 hover:bg-slate-50/80 transition-colors">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <span className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                              {claim.name}
                              <code className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-normal">
                                {claim.key}
                              </code>
                            </span>
                            <span className="text-[11px] font-mono font-medium text-blue-600 break-all text-right">
                              {claim.value}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal">{claim.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No standard RFC 7519 claims found in this token payload.
                    </div>
                  )}
                </div>
              )}

              {/* Signature Note */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Privacy & Integrity:</strong> This token was decoded 100% inside your browser runtime. The cryptographic signature is present, but signature verification against a private/public secret key is omitted to guarantee zero key leakage.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
