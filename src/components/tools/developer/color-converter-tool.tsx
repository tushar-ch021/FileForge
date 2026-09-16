"use client";

import React, { useState, useMemo } from "react";
import {
  Palette,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  parseColor,
  getColorDetails,
  CURATED_COLORS,
  type RgbColor,
  type ColorDetails,
} from "@/lib/developer/color-converter";

export function ColorConverterTool() {
  // Current active color state in RGB format
  const [rgbState, setRgbState] = useState<RgbColor>({ r: 37, g: 99, b: 235, a: 1 }); // #2563eb
  const [hexInput, setHexInput] = useState<string>("#2563eb");
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Compute color details directly during render
  const details: ColorDetails = useMemo(() => {
    return getColorDetails(rgbState);
  }, [rgbState]);

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const parsed = parseColor(val);
    if (parsed) {
      setRgbState(parsed);
      setHexInput(val);
    }
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    const parsed = parseColor(val);
    if (parsed) {
      setRgbState(parsed);
    }
  };

  const handleSelectPreset = (hex: string) => {
    const parsed = parseColor(hex);
    if (parsed) {
      setRgbState(parsed);
      setHexInput(hex);
    }
  };

  const handleCopy = async (text: string, formatKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(formatKey);
      setTimeout(() => setCopiedFormat(null), 1500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Presets Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700 mr-1">Curated Presets:</span>
          {CURATED_COLORS.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              onClick={() => handleSelectPreset(preset.hex)}
              className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs hover:border-slate-300 transition-colors"
              title={preset.name}
            >
              <span
                className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: preset.hex }}
              />
              <span className="text-slate-700 font-medium">{preset.name}</span>
            </button>
          ))}
        </div>

        <Badge variant="outline" className="bg-white text-xs gap-1 text-slate-600 border-slate-200">
          <Palette className="h-3.5 w-3.5 text-blue-600" />
          Full Color Space Sync
        </Badge>
      </div>

      {/* Main Grid: Visual Swatch on Left, Converted Formats on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Swatch & Native Picker */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
            {/* Color Swatch Display */}
            <div
              className="w-full h-44 rounded-xl border border-slate-200/80 shadow-inner flex flex-col justify-end p-4 transition-colors relative overflow-hidden"
              style={{ backgroundColor: details.hex }}
            >
              {/* Native Color Picker Trigger */}
              <label
                htmlFor="native-color-picker"
                className="absolute inset-0 cursor-pointer opacity-0"
                title="Click to pick color"
              >
                <input
                  id="native-color-picker"
                  type="color"
                  value={details.hex}
                  onChange={handleColorPickerChange}
                  className="w-full h-full cursor-pointer"
                />
              </label>

              <div className="bg-black/40 backdrop-blur-xs rounded-lg px-3 py-1.5 text-white flex items-center justify-between pointer-events-none">
                <span className="font-mono text-xs font-bold uppercase">{details.hex}</span>
                <span className="text-[11px] opacity-80">Click swatch to pick</span>
              </div>
            </div>

            {/* Quick Hex Input */}
            <div className="space-y-1.5">
              <label htmlFor="hex-field" className="text-xs font-semibold text-slate-700">
                HEX Color Value
              </label>
              <div className="flex gap-2">
                <input
                  id="hex-field"
                  type="text"
                  value={hexInput}
                  onChange={handleHexInputChange}
                  placeholder="#2563eb"
                  maxLength={9}
                  className="flex-1 px-3 py-2 font-mono text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 uppercase"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(details.hex, "hex-main")}
                  className="h-9 text-xs gap-1 bg-white"
                >
                  {copiedFormat === "hex-main" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy
                </Button>
              </div>
            </div>

            {/* Complementary Color */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-lg border border-black/10 shrink-0"
                  style={{ backgroundColor: details.complementaryHex }}
                />
                <div className="text-xs">
                  <div className="font-semibold text-slate-800">Complementary</div>
                  <div className="font-mono text-slate-500 text-[11px] uppercase">
                    {details.complementaryHex}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSelectPreset(details.complementaryHex)}
                className="h-7 text-xs text-blue-600 gap-1 hover:bg-blue-50"
              >
                Use <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Format Outputs */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h4 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
              Color Formats &amp; CSS Ready Values
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
              {/* Format 1: HEX */}
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">HEX (6-digit)</div>
                  <div className="font-semibold text-slate-900 uppercase">{details.hex}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(details.hex, "fmt-hex")}
                  className="h-7 text-xs gap-1"
                >
                  {copiedFormat === "fmt-hex" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>

              {/* Format 2: RGB */}
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">RGB Format</div>
                  <div className="font-semibold text-slate-900">{details.rgbString}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(details.rgbString, "fmt-rgb")}
                  className="h-7 text-xs gap-1"
                >
                  {copiedFormat === "fmt-rgb" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>

              {/* Format 3: HSL */}
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">HSL Format</div>
                  <div className="font-semibold text-slate-900">{details.hslString}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(details.hslString, "fmt-hsl")}
                  className="h-7 text-xs gap-1"
                >
                  {copiedFormat === "fmt-hsl" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>

              {/* Format 4: HSV */}
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">HSV / HSB</div>
                  <div className="font-semibold text-slate-900">{details.hsvString}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(details.hsvString, "fmt-hsv")}
                  className="h-7 text-xs gap-1"
                >
                  {copiedFormat === "fmt-hsv" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>

              {/* Format 5: CMYK */}
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center justify-between gap-2 md:col-span-2">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">CMYK (Print)</div>
                  <div className="font-semibold text-slate-900">{details.cmykString}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(details.cmykString, "fmt-cmyk")}
                  className="h-7 text-xs gap-1"
                >
                  {copiedFormat === "fmt-cmyk" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Tints & Shades Palette Preview */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Tints (Adding White)
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {details.tints.map((tintHex) => (
                    <button
                      key={tintHex}
                      type="button"
                      onClick={() => handleSelectPreset(tintHex)}
                      className="h-8 rounded-lg border border-black/10 transition-transform hover:scale-105"
                      style={{ backgroundColor: tintHex }}
                      title={`Tint: ${tintHex}`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Shades (Adding Black)
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {details.shades.map((shadeHex) => (
                    <button
                      key={shadeHex}
                      type="button"
                      onClick={() => handleSelectPreset(shadeHex)}
                      className="h-8 rounded-lg border border-black/10 transition-transform hover:scale-105"
                      style={{ backgroundColor: shadeHex }}
                      title={`Shade: ${shadeHex}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WCAG 2.1 Contrast Accessibility Preview Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <h4 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
            WCAG 2.1 Accessibility &amp; Contrast Analysis
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Black text on color */}
          <div
            className="p-4 rounded-xl border border-slate-200 space-y-3"
            style={{ backgroundColor: details.hex }}
          >
            <div className="text-black space-y-1">
              <div className="text-base font-bold">Black Text Contrast</div>
              <p className="text-xs opacity-90">
                The quick brown fox jumps over the lazy dog.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-white/90 backdrop-blur-xs text-slate-900 text-xs flex items-center justify-between">
              <span className="font-semibold">
                Ratio: {details.contrast.contrastBlack}:1
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                {details.contrast.wcagBlack.aaNormal ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> AA Pass
                  </Badge>
                ) : (
                  <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-0 gap-1 text-[10px]">
                    <XCircle className="h-3 w-3 text-rose-600" /> AA Fail
                  </Badge>
                )}

                {details.contrast.wcagBlack.aaaNormal && (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 text-[10px]">
                    AAA Pass
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* White text on color */}
          <div
            className="p-4 rounded-xl border border-slate-200 space-y-3"
            style={{ backgroundColor: details.hex }}
          >
            <div className="text-white space-y-1">
              <div className="text-base font-bold">White Text Contrast</div>
              <p className="text-xs opacity-90">
                The quick brown fox jumps over the lazy dog.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-black/60 backdrop-blur-xs text-white text-xs flex items-center justify-between">
              <span className="font-semibold">
                Ratio: {details.contrast.contrastWhite}:1
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                {details.contrast.wcagWhite.aaNormal ? (
                  <Badge className="bg-emerald-500 text-white hover:bg-emerald-500 border-0 gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> AA Pass
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500 text-white hover:bg-rose-500 border-0 gap-1 text-[10px]">
                    <XCircle className="h-3 w-3" /> AA Fail
                  </Badge>
                )}

                {details.contrast.wcagWhite.aaaNormal && (
                  <Badge className="bg-emerald-500 text-white hover:bg-emerald-500 border-0 text-[10px]">
                    AAA Pass
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
