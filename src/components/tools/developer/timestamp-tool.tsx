"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Copy,
  Check,
  Calendar,
  Globe,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  parseTimestampInput,
  parseDateString,
  type TimestampUnit,
  type TimestampParseResult,
} from "@/lib/developer/timestamp";
import { cn } from "@/lib/utils";

export function TimestampTool() {
  // Live ticker epoch state (updates every second)
  const [currentNow, setCurrentNow] = useState<number>(() => Date.now());
  const [tickerPaused, setTickerPaused] = useState<boolean>(false);

  // Conversion Mode
  const [mode, setMode] = useState<"to-date" | "to-timestamp">("to-date");

  // Input states
  const [timestampInput, setTimestampInput] = useState<string>(() =>
    Math.floor(Date.now() / 1000).toString()
  );
  const [specifiedUnit, setSpecifiedUnit] = useState<TimestampUnit | "auto">("auto");

  // Date input state (YYYY-MM-DDTHH:mm)
  const [dateInput, setDateInput] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Ticker timer effect
  useEffect(() => {
    if (tickerPaused) return;
    const interval = setInterval(() => {
      setCurrentNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [tickerPaused]);

  // Derived parse result for Timestamp -> Date
  const timestampResult: TimestampParseResult = useMemo(() => {
    const unit = specifiedUnit === "auto" ? undefined : specifiedUnit;
    return parseTimestampInput(timestampInput, unit);
  }, [timestampInput, specifiedUnit]);

  // Derived parse result for Date -> Timestamp
  const dateResult: TimestampParseResult = useMemo(() => {
    return parseDateString(dateInput);
  }, [dateInput]);

  const activeResult = mode === "to-date" ? timestampResult : dateResult;

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // Fallback
    }
  };

  const handleAdjustSeconds = (secondsDelta: number) => {
    const base = Number(timestampInput.replace(/,/g, ""));
    const current = isNaN(base) ? Math.floor(currentNow / 1000) : base;
    setTimestampInput(String(Math.round(current + secondsDelta)));
  };

  const handleSetNow = () => {
    const nowSec = Math.floor(currentNow / 1000);
    setTimestampInput(nowSec.toString());
    const d = new Date(currentNow);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setDateInput(d.toISOString().slice(0, 16));
  };

  return (
    <div className="w-full space-y-6">
      {/* Live Current Epoch Banner */}
      <div className="p-4 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border border-blue-100 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  tickerPaused ? "bg-slate-400" : "bg-emerald-400"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  tickerPaused ? "bg-slate-500" : "bg-emerald-500"
                )}
              />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Current Unix Epoch
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3 font-mono">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {Math.floor(currentNow / 1000)}
            </div>
            <span className="text-xs text-slate-500 font-medium">seconds</span>

            <span className="text-slate-300 hidden sm:inline">•</span>

            <div className="text-sm font-semibold text-slate-700">
              {currentNow}
            </div>
            <span className="text-xs text-slate-500 font-medium">ms</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleCopy(Math.floor(currentNow / 1000).toString(), "now-sec")}
            className="h-8 text-xs gap-1.5 bg-white"
          >
            {copiedKey === "now-sec" ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Copy Seconds
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTickerPaused((p) => !p)}
            className="h-8 text-xs text-slate-600 hover:text-slate-900"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", !tickerPaused && "animate-spin-slow")} />
            {tickerPaused ? "Resume" : "Pause"}
          </Button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 w-fit">
        <button
          type="button"
          onClick={() => setMode("to-date")}
          className={cn(
            "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
            mode === "to-date"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Clock className="h-3.5 w-3.5 text-blue-600" />
          Timestamp → Human Date
        </button>

        <button
          type="button"
          onClick={() => setMode("to-timestamp")}
          className={cn(
            "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
            mode === "to-timestamp"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Calendar className="h-3.5 w-3.5 text-indigo-600" />
          Human Date → Timestamp
        </button>
      </div>

      {/* Main Converter Card */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-5">
        {mode === "to-date" ? (
          /* Sub-view: Timestamp to Date */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="epoch-input" className="text-sm font-semibold text-slate-900">
                Enter Timestamp Number
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Unit:</span>
                <select
                  value={specifiedUnit}
                  onChange={(e) => setSpecifiedUnit(e.target.value as TimestampUnit | "auto")}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="auto">Auto-detect (10/13/16 digits)</option>
                  <option value="seconds">Seconds (10 digits)</option>
                  <option value="milliseconds">Milliseconds (13 digits)</option>
                  <option value="microseconds">Microseconds (16 digits)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                id="epoch-input"
                type="text"
                value={timestampInput}
                onChange={(e) => setTimestampInput(e.target.value)}
                placeholder="e.g. 1773595200..."
                className="flex-1 px-4 py-2.5 font-mono text-sm font-semibold bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSetNow}
                className="text-xs gap-1 h-10 px-3 bg-white"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                Now
              </Button>
            </div>

            {/* Quick Math Adjustments */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-slate-500 font-medium mr-1">Adjust:</span>
              {[
                { label: "-1h", delta: -3600 },
                { label: "+1h", delta: 3600 },
                { label: "-1d", delta: -86400 },
                { label: "+1d", delta: 86400 },
                { label: "-1w", delta: -604800 },
                { label: "+1w", delta: 604800 },
                { label: "-30d", delta: -2592000 },
                { label: "+30d", delta: 2592000 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => handleAdjustSeconds(btn.delta)}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                >
                  {btn.label.startsWith("+") ? <Plus className="inline h-2.5 w-2.5 mr-0.5" /> : <Minus className="inline h-2.5 w-2.5 mr-0.5" />}
                  {btn.label.slice(1)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Sub-view: Human Date to Timestamp */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="date-input" className="text-sm font-semibold text-slate-900">
                Pick Date &amp; Time (Local)
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSetNow}
                className="text-xs gap-1 h-7 text-blue-600 hover:text-blue-700"
              >
                Set to current time
              </Button>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-3">
              <input
                id="date-input"
                type="datetime-local"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="flex-1 px-4 py-2.5 font-mono text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {!activeResult.isValid && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2 text-xs">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-rose-700 font-medium">{activeResult.error}</p>
          </div>
        )}

        {/* Formatted Breakdown Display */}
        {activeResult.isValid && activeResult.breakdown && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
                Date &amp; Time Formats
              </h4>
              {activeResult.detectedUnit && (
                <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0 bg-slate-50">
                  Unit: {activeResult.detectedUnit}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Card 1: Local Time */}
              <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-blue-600" />
                    Local Time ({activeResult.breakdown.timezone})
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(activeResult.breakdown!.local, "local")}
                    className="h-5 px-1 text-[11px] text-slate-500 hover:text-slate-900"
                  >
                    {copiedKey === "local" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <div className="font-semibold text-xs text-slate-900 break-all font-mono">
                  {activeResult.breakdown.local}
                </div>
              </div>

              {/* Card 2: UTC Time */}
              <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3 text-emerald-600" />
                    UTC / GMT
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(activeResult.breakdown!.utc, "utc")}
                    className="h-5 px-1 text-[11px] text-slate-500 hover:text-slate-900"
                  >
                    {copiedKey === "utc" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <div className="font-semibold text-xs text-slate-900 break-all font-mono">
                  {activeResult.breakdown.utc}
                </div>
              </div>

              {/* Card 3: ISO 8601 */}
              <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>ISO 8601 Standard</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(activeResult.breakdown!.iso, "iso")}
                    className="h-5 px-1 text-[11px] text-slate-500 hover:text-slate-900"
                  >
                    {copiedKey === "iso" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <div className="font-semibold text-xs text-blue-600 break-all font-mono">
                  {activeResult.breakdown.iso}
                </div>
              </div>

              {/* Card 4: Relative Time */}
              <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>Relative Time</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(activeResult.breakdown!.relative, "relative")}
                    className="h-5 px-1 text-[11px] text-slate-500 hover:text-slate-900"
                  >
                    {copiedKey === "relative" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <div className="font-semibold text-xs text-indigo-700 capitalize font-mono">
                  {activeResult.breakdown.relative}
                </div>
              </div>
            </div>

            {/* Epoch Numeric Details */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-500">Epoch Seconds:</span>
                <code className="font-mono font-bold text-slate-900 select-all">
                  {activeResult.breakdown.epochSeconds}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(activeResult.breakdown!.epochSeconds.toString(), "epoch-sec")}
                  className="h-5 w-5 p-0 text-slate-500"
                >
                  {copiedKey === "epoch-sec" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-500">Epoch Milliseconds:</span>
                <code className="font-mono font-bold text-slate-900 select-all">
                  {activeResult.breakdown.epochMilliseconds}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(activeResult.breakdown!.epochMilliseconds.toString(), "epoch-ms")}
                  className="h-5 w-5 p-0 text-slate-500"
                >
                  {copiedKey === "epoch-ms" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>

              <div className="flex items-center gap-3 text-slate-500">
                <span>Day #{activeResult.breakdown.dayOfYear} of year</span>
                <span>•</span>
                <span>Week #{activeResult.breakdown.weekNumber}</span>
                {activeResult.breakdown.isLeapYear && (
                  <>
                    <span>•</span>
                    <Badge variant="outline" className="text-[10px] bg-white text-slate-700">Leap Year</Badge>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
