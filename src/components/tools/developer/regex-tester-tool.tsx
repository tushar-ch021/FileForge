"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  FileCode2,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  Table,
  Eye,
  Replace,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  testRegex,
  parseFlagsString,
  REGEX_PRESETS,
  type RegexFlags,
  type RegexTestResult,
} from "@/lib/developer/regex-tester";
import { cn } from "@/lib/utils";

export function RegexTesterTool() {
  const [pattern, setPattern] = useState<string>("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");
  const [flags, setFlags] = useState<RegexFlags>({
    global: true,
    ignoreCase: false,
    multiline: false,
    dotAll: false,
    unicode: false,
  });
  const [testString, setTestString] = useState<string>(
    "Reach our support at help@fileforge.io or team-alpha@company.org. For urgent alerts contact ops@subdomain.example.co.uk!"
  );
  const [replacement, setReplacement] = useState<string>("");
  const [showReplace, setShowReplace] = useState<boolean>(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const patternInputRef = useRef<HTMLInputElement>(null);

  // Compute regex test result directly during render
  const testResult: RegexTestResult = useMemo(() => {
    return testRegex(pattern, flags, testString, showReplace ? replacement : undefined);
  }, [pattern, flags, testString, showReplace, replacement]);

  const toggleFlag = (flagKey: keyof RegexFlags) => {
    setFlags((prev) => ({ ...prev, [flagKey]: !prev[flagKey] }));
  };

  const handleSelectPreset = (presetId: string) => {
    const preset = REGEX_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setPattern(preset.pattern);
      setFlags(parseFlagsString(preset.flags));
      setTestString(preset.sampleText);
    }
  };

  const handleClear = () => {
    setPattern("");
    setTestString("");
    setReplacement("");
    patternInputRef.current?.focus();
  };

  const handleCopy = async (text: string, sectionKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionKey);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      // Fallback
    }
  };

  // Build highlighted JSX from test string matches
  const highlightedNodes = useMemo(() => {
    if (!testString) return null;
    if (!testResult.isValid || testResult.matches.length === 0) {
      return <span>{testString}</span>;
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    testResult.matches.forEach((m, idx) => {
      // Unmatched prefix text
      if (m.start > lastIndex) {
        elements.push(
          <span key={`text-${idx}`}>{testString.slice(lastIndex, m.start)}</span>
        );
      }

      // Matched text highlight
      elements.push(
        <mark
          key={`match-${idx}`}
          className="bg-amber-200 text-amber-950 font-semibold px-0.5 rounded border-b-2 border-amber-500"
          title={`Match #${idx + 1} (${m.start}..${m.end})`}
        >
          {m.match}
        </mark>
      );

      lastIndex = m.end;
    });

    // Remaining tail text
    if (lastIndex < testString.length) {
      elements.push(
        <span key="text-end">{testString.slice(lastIndex)}</span>
      );
    }

    return elements;
  }, [testString, testResult]);

  return (
    <div className="w-full space-y-6">
      {/* Top Presets & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
        {/* Left: Quick Presets */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700">Quick Presets:</span>
          <select
            onChange={(e) => handleSelectPreset(e.target.value)}
            defaultValue=""
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="" disabled>
              Select common pattern...
            </option>
            {REGEX_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowReplace((prev) => !prev)}
            className={cn(
              "text-xs gap-1.5 h-8 bg-white",
              showReplace && "border-blue-500 text-blue-600 bg-blue-50/50"
            )}
          >
            <Replace className="h-3.5 w-3.5" />
            {showReplace ? "Hide Substitution" : "Substitution"}
          </Button>

          {(pattern || testString) && (
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

      {/* Regex Pattern Input Row */}
      <div className="space-y-2">
        <label htmlFor="regex-pattern-input" className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <FileCode2 className="h-4 w-4 text-blue-600" />
          Regular Expression
        </label>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 bg-white rounded-2xl border border-slate-200 shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <span className="font-mono text-base font-bold text-slate-400 pl-2 select-none">/</span>
          <input
            id="regex-pattern-input"
            ref={patternInputRef}
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Type regex pattern (e.g. \b[A-Z]+\b)..."
            spellCheck={false}
            className="flex-1 font-mono text-xs text-slate-900 focus:outline-none px-1 py-1"
          />
          <span className="font-mono text-base font-bold text-slate-400 select-none">/</span>

          {/* Flags Selector Chips */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
            {[
              { key: "global" as const, char: "g", title: "Global (find all matches)" },
              { key: "ignoreCase" as const, char: "i", title: "Case-insensitive" },
              { key: "multiline" as const, char: "m", title: "Multiline (^ and $ match line bounds)" },
              { key: "dotAll" as const, char: "s", title: "dotAll (. matches newlines)" },
              { key: "unicode" as const, char: "u", title: "Unicode full character support" },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleFlag(f.key)}
                title={f.title}
                className={cn(
                  "w-6 h-6 rounded-lg text-xs font-mono font-bold transition-all",
                  flags[f.key]
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {f.char}
              </button>
            ))}
          </div>
        </div>

        {/* Syntax Error Alert */}
        {!testResult.isValid && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2 text-xs">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">RegEx Syntax Error:</span>
              <p className="text-rose-700">{testResult.error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Substitution Input (Optional) */}
      {showReplace && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="regex-replacement-input" className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Replace className="h-3.5 w-3.5 text-blue-600" />
              Replacement String
            </label>
            <span className="text-[11px] text-slate-500">Supports $1, $2, $&amp; group tokens</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="regex-replacement-input"
              type="text"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="e.g. [$1] or [REDACTED]..."
              className="flex-1 px-3 py-1.5 font-mono text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
            {testResult.replacedText !== undefined && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy(testResult.replacedText!, "replaced")}
                className="h-8 text-xs gap-1 bg-white"
              >
                {copiedSection === "replaced" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy Result
                  </>
                )}
              </Button>
            )}
          </div>

          {testResult.replacedText !== undefined && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 font-mono text-xs text-slate-800 break-all leading-relaxed">
              {testResult.replacedText}
            </div>
          )}
        </div>
      )}

      {/* Test String & Live Visualizer Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test String Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="regex-test-string" className="text-sm font-semibold text-slate-900">
              Test String
            </label>
            <span className="text-xs text-slate-500">{testString.length} characters</span>
          </div>

          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <textarea
              id="regex-test-string"
              value={testString}
              onChange={(e) => setTestString(e.target.value)}
              placeholder="Enter or paste text to test regular expression against..."
              rows={10}
              spellCheck={false}
              className="w-full resize-y rounded-2xl p-3.5 font-mono text-xs text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Highlighted Match Visualizer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-slate-900">Match Preview</span>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px] px-2 py-0.5",
                  testResult.matchCount > 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
                    : "bg-slate-50 text-slate-500"
                )}
              >
                {testResult.matchCount} match{testResult.matchCount === 1 ? "" : "es"}
              </Badge>
              {testResult.executionTimeMs !== undefined && (
                <span className="text-[11px] text-slate-400 font-mono">
                  {testResult.executionTimeMs}ms
                </span>
              )}
            </div>
          </div>

          <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 min-h-[200px] max-h-[260px] overflow-y-auto font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap break-all shadow-xs">
            {testString ? (
              highlightedNodes
            ) : (
              <span className="text-slate-400 italic">
                Test string preview and matches will appear here...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Matches Breakdown Table */}
      {testResult.matches.length > 0 && (
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Table className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-xs text-slate-900">
                Detailed Match Breakdown ({testResult.matches.length})
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const list = testResult.matches.map((m) => m.match).join("\n");
                handleCopy(list, "all-matches");
              }}
              className="h-7 text-xs gap-1.5 bg-white"
            >
              {copiedSection === "all-matches" ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" /> Copied Matches
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy All Matches
                </>
              )}
            </Button>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 text-[11px]">
                  <th className="py-2.5 px-4 font-semibold w-16">#</th>
                  <th className="py-2.5 px-4 font-semibold w-1/3">Match</th>
                  <th className="py-2.5 px-4 font-semibold w-28">Range</th>
                  <th className="py-2.5 px-4 font-semibold">Capture Groups</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {testResult.matches.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 text-slate-400 font-medium">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 break-all select-all">
                      {item.match}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      [{item.start}..{item.end}]
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {item.groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {item.groups.map((grp, gIdx) => (
                            <span
                              key={gIdx}
                              className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              {grp.name ? `${grp.name}: ` : `$${grp.index}: `}
                              <strong>{grp.value}</strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
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
