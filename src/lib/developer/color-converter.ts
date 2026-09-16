/**
 * Pure color conversion and accessibility contrast analysis engine.
 * Supports HEX, RGB, RGBA, HSL, HSLA, HSV, and CMYK.
 * Independent of React or UI frameworks.
 * 100% in-browser client-side execution.
 */

export interface RgbColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a?: number; // 0-1
}

export interface HslColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
  a?: number; // 0-1
}

export interface HsvColor {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

export interface CmykColor {
  c: number; // 0-100
  m: number; // 0-100
  y: number; // 0-100
  k: number; // 0-100
}

export interface ColorContrastInfo {
  luminance: number;
  contrastWhite: number; // e.g. 4.5
  contrastBlack: number; // e.g. 12.1
  wcagWhite: {
    aaNormal: boolean;
    aaLarge: boolean;
    aaaNormal: boolean;
  };
  wcagBlack: {
    aaNormal: boolean;
    aaLarge: boolean;
    aaaNormal: boolean;
  };
}

export interface ColorDetails {
  hex: string;
  hex8: string;
  rgb: RgbColor;
  rgbString: string;
  hsl: HslColor;
  hslString: string;
  hsv: HsvColor;
  hsvString: string;
  cmyk: CmykColor;
  cmykString: string;
  contrast: ColorContrastInfo;
  complementaryHex: string;
  tints: string[]; // lighter variations
  shades: string[]; // darker variations
}

/**
 * Normalizes number to range [min, max]
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(val, max));
}

/**
 * Calculates linear relative luminance for WCAG contrast (sRGB formula)
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates contrast ratio between two relative luminance values
 */
export function getContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Converts RGB to HEX string
 */
export function rgbToHex(rgb: RgbColor): { hex: string; hex8: string } {
  const toHex = (n: number) =>
    Math.round(clamp(n, 0, 255))
      .toString(16)
      .padStart(2, "0");

  const r = toHex(rgb.r);
  const g = toHex(rgb.g);
  const b = toHex(rgb.b);
  const alphaVal = rgb.a !== undefined ? rgb.a : 1;
  const a = toHex(Math.round(clamp(alphaVal, 0, 1) * 255));

  return {
    hex: `#${r}${g}${b}`,
    hex8: `#${r}${g}${b}${a}`,
  };
}

/**
 * Converts RGB to HSL
 */
export function rgbToHsl(rgb: RgbColor): HslColor {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      case b:
        h = (r - g) / delta + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    a: rgb.a,
  };
}

/**
 * Converts HSL to RGB
 */
export function hslToRgb(hsl: HslColor): RgbColor {
  const h = (hsl.h % 360) / 360;
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    return { r: val, g: val, b: val, a: hsl.a };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let normalized = t;
    if (normalized < 0) normalized += 1;
    if (normalized > 1) normalized -= 1;
    if (normalized < 1 / 6) return p + (q - p) * 6 * normalized;
    if (normalized < 1 / 2) return q;
    if (normalized < 2 / 3) return p + (q - p) * (2 / 3 - normalized) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return { r, g, b, a: hsl.a };
}

/**
 * Converts RGB to HSV
 */
export function rgbToHsv(rgb: RgbColor): HsvColor {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  const v = max;
  const s = max === 0 ? 0 : delta / max;

  if (delta !== 0) {
    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      case b:
        h = (r - g) / delta + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

/**
 * Converts RGB to CMYK
 */
export function rgbToCmyk(rgb: RgbColor): CmykColor {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;

  const k = 1 - Math.max(r, g, b);
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

/**
 * Parses any color string format into an RgbColor
 */
export function parseColor(input: string): RgbColor | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Check HEX formats: #fff, #ffff, #ffffff, #ffffffff
  const hexMatch = trimmed.match(/^#?([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: parseFloat((parseInt(hex[3] + hex[3], 16) / 255).toFixed(2)),
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseFloat((parseInt(hex.slice(6, 8), 16) / 255).toFixed(2)),
      };
    }
  }

  // 2. Check rgb(...) / rgba(...)
  const rgbMatch = trimmed.match(/^rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i);
  if (rgbMatch) {
    return {
      r: clamp(parseInt(rgbMatch[1], 10), 0, 255),
      g: clamp(parseInt(rgbMatch[2], 10), 0, 255),
      b: clamp(parseInt(rgbMatch[3], 10), 0, 255),
      a: rgbMatch[4] !== undefined ? clamp(parseFloat(rgbMatch[4]), 0, 1) : 1,
    };
  }

  // 3. Check hsl(...) / hsla(...)
  const hslMatch = trimmed.match(/^hsla?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?(?:\s*,\s*([0-9.]+))?\s*\)$/i);
  if (hslMatch) {
    const hsl: HslColor = {
      h: clamp(parseInt(hslMatch[1], 10), 0, 360),
      s: clamp(parseInt(hslMatch[2], 10), 0, 100),
      l: clamp(parseInt(hslMatch[3], 10), 0, 100),
      a: hslMatch[4] !== undefined ? clamp(parseFloat(hslMatch[4]), 0, 1) : 1,
    };
    return hslToRgb(hsl);
  }

  return null;
}

/**
 * Computes full color breakdown including contrast, complementary color, tints, and shades.
 */
export function getColorDetails(rgb: RgbColor): ColorDetails {
  const { hex, hex8 } = rgbToHex(rgb);
  const hsl = rgbToHsl(rgb);
  const hsv = rgbToHsv(rgb);
  const cmyk = rgbToCmyk(rgb);

  const rgbString =
    rgb.a !== undefined && rgb.a < 1
      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`
      : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

  const hslString =
    hsl.a !== undefined && hsl.a < 1
      ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${hsl.a})`
      : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

  const hsvString = `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`;
  const cmykString = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;

  // Contrast calculations
  const luminance = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
  const contrastWhite = parseFloat(getContrastRatio(luminance, 1).toFixed(2));
  const contrastBlack = parseFloat(getContrastRatio(luminance, 0).toFixed(2));

  const contrast: ColorContrastInfo = {
    luminance: parseFloat(luminance.toFixed(3)),
    contrastWhite,
    contrastBlack,
    wcagWhite: {
      aaNormal: contrastWhite >= 4.5,
      aaLarge: contrastWhite >= 3.0,
      aaaNormal: contrastWhite >= 7.0,
    },
    wcagBlack: {
      aaNormal: contrastBlack >= 4.5,
      aaLarge: contrastBlack >= 3.0,
      aaaNormal: contrastBlack >= 7.0,
    },
  };

  // Complementary color (hue + 180)
  const compHsl: HslColor = { ...hsl, h: (hsl.h + 180) % 360 };
  const compRgb = hslToRgb(compHsl);
  const complementaryHex = rgbToHex(compRgb).hex;

  // Tints (mix with white)
  const tints: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const factor = i * 0.15;
    const r = Math.round(rgb.r + (255 - rgb.r) * factor);
    const g = Math.round(rgb.g + (255 - rgb.g) * factor);
    const b = Math.round(rgb.b + (255 - rgb.b) * factor);
    tints.push(rgbToHex({ r, g, b }).hex);
  }

  // Shades (mix with black)
  const shades: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const factor = 1 - i * 0.15;
    const r = Math.round(rgb.r * factor);
    const g = Math.round(rgb.g * factor);
    const b = Math.round(rgb.b * factor);
    shades.push(rgbToHex({ r, g, b }).hex);
  }

  return {
    hex,
    hex8,
    rgb,
    rgbString,
    hsl,
    hslString,
    hsv,
    hsvString,
    cmyk,
    cmykString,
    contrast,
    complementaryHex,
    tints,
    shades,
  };
}

export const CURATED_COLORS = [
  { name: "Brand Blue", hex: "#2563eb" },
  { name: "Navy Dark", hex: "#0f172a" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Amber Gold", hex: "#f59e0b" },
  { name: "Rose Coral", hex: "#f43f5e" },
  { name: "Purple Indigo", hex: "#6366f1" },
  { name: "Teal Cyan", hex: "#06b6d4" },
];
