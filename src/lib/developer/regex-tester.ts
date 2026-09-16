/**
 * Pure regular expression testing and evaluation engine.
 * Independent of React or UI frameworks.
 * 100% in-browser client-side execution.
 */

export interface RegexFlags {
  global: boolean; // g
  ignoreCase: boolean; // i
  multiline: boolean; // m
  dotAll: boolean; // s
  unicode: boolean; // u
}

export interface RegexMatchGroup {
  index: number;
  name?: string;
  value: string;
}

export interface RegexMatchItem {
  index: number;
  length: number;
  match: string;
  groups: RegexMatchGroup[];
  start: number;
  end: number;
}

export interface RegexTestResult {
  isValid: boolean;
  error?: string;
  matches: RegexMatchItem[];
  matchCount: number;
  replacedText?: string;
  executionTimeMs: number;
}

export interface RegexPreset {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  description: string;
  sampleText: string;
}

export const REGEX_PRESETS: RegexPreset[] = [
  {
    id: "email",
    name: "Email Address",
    pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    flags: "g",
    description: "Matches standard email addresses",
    sampleText: "Contact us at support@fileforge.io or dev-team+ops@domain.co.uk for inquiries.",
  },
  {
    id: "url",
    name: "Web URL",
    pattern: "https?:\\/\\/(?:www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)",
    flags: "gi",
    description: "Matches HTTP and HTTPS URLs",
    sampleText: "Visit https://fileforge.io/developer/regex-tester or http://localhost:3000 for local testing.",
  },
  {
    id: "ipv4",
    name: "IPv4 Address",
    pattern: "\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b",
    flags: "g",
    description: "Matches valid IPv4 addresses (0.0.0.0 to 255.255.255.255)",
    sampleText: "Server IP: 192.168.1.1, gateway: 10.0.0.254, invalid: 999.12.34.56.",
  },
  {
    id: "hex-color",
    name: "Hex Color",
    pattern: "#(?:[0-9a-fA-F]{3,4}){1,2}\\b",
    flags: "g",
    description: "Matches 3, 4, 6, and 8 digit hex color codes",
    sampleText: "Primary: #2563eb, Navy: #0f172a, Accent: #10b981, Short: #fff, Alpha: #2563eb80.",
  },
  {
    id: "date-iso",
    name: "ISO Date (YYYY-MM-DD)",
    pattern: "\\b(\\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])\\b",
    flags: "g",
    description: "Matches ISO dates with year, month, and day capture groups",
    sampleText: "Launch date: 2026-09-15, audit date: 2026-10-01, invalid: 2024-13-45.",
  },
  {
    id: "slug",
    name: "URL Slug",
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    flags: "",
    description: "Validates lowercase alphanumeric hyphenated slug",
    sampleText: "developer-tools-regex-tester-2026",
  },
];

/**
 * Builds a flags string from a boolean map.
 */
export function flagsToString(flags: RegexFlags): string {
  let res = "";
  if (flags.global) res += "g";
  if (flags.ignoreCase) res += "i";
  if (flags.multiline) res += "m";
  if (flags.dotAll) res += "s";
  if (flags.unicode) res += "u";
  return res;
}

/**
 * Parses a string of flag characters into a boolean map.
 */
export function parseFlagsString(flagsStr: string): RegexFlags {
  return {
    global: flagsStr.includes("g"),
    ignoreCase: flagsStr.includes("i"),
    multiline: flagsStr.includes("m"),
    dotAll: flagsStr.includes("s"),
    unicode: flagsStr.includes("u"),
  };
}

/**
 * Executes regular expression evaluation against test string with performance timing.
 */
export function testRegex(
  pattern: string,
  flags: RegexFlags,
  testString: string,
  replacement?: string
): RegexTestResult {
  if (!pattern) {
    return {
      isValid: true,
      matches: [],
      matchCount: 0,
      executionTimeMs: 0,
    };
  }

  const flagsStr = flagsToString(flags);
  const startTime = performance.now();

  try {
    const regex = new RegExp(pattern, flagsStr);
    const matches: RegexMatchItem[] = [];

    if (flags.global) {
      let match: RegExpExecArray | null;
      let iterations = 0;
      const maxIterations = 5000; // Safeguard against zero-width infinite loops

      while ((match = regex.exec(testString)) !== null && iterations < maxIterations) {
        iterations++;
        const matchItem: RegexMatchItem = {
          index: match.index,
          length: match[0].length,
          match: match[0],
          start: match.index,
          end: match.index + match[0].length,
          groups: [],
        };

        // Extract capture groups
        for (let i = 1; i < match.length; i++) {
          if (match[i] !== undefined) {
            matchItem.groups.push({
              index: i,
              value: match[i],
            });
          }
        }

        // Extract named groups if present
        if (match.groups) {
          for (const [name, val] of Object.entries(match.groups)) {
            if (val !== undefined) {
              const existing = matchItem.groups.find((g) => g.value === val);
              if (existing) {
                existing.name = name;
              } else {
                matchItem.groups.push({
                  index: matchItem.groups.length + 1,
                  name,
                  value: val,
                });
              }
            }
          }
        }

        matches.push(matchItem);

        // Safeguard for zero-length matches (e.g. ^ or \b) to prevent infinite loop
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    } else {
      const match = regex.exec(testString);
      if (match) {
        const matchItem: RegexMatchItem = {
          index: match.index,
          length: match[0].length,
          match: match[0],
          start: match.index,
          end: match.index + match[0].length,
          groups: [],
        };

        for (let i = 1; i < match.length; i++) {
          if (match[i] !== undefined) {
            matchItem.groups.push({
              index: i,
              value: match[i],
            });
          }
        }

        if (match.groups) {
          for (const [name, val] of Object.entries(match.groups)) {
            if (val !== undefined) {
              const existing = matchItem.groups.find((g) => g.value === val);
              if (existing) {
                existing.name = name;
              } else {
                matchItem.groups.push({
                  index: matchItem.groups.length + 1,
                  name,
                  value: val,
                });
              }
            }
          }
        }

        matches.push(matchItem);
      }
    }

    let replacedText: string | undefined;
    if (replacement !== undefined && replacement !== "") {
      try {
        replacedText = testString.replace(new RegExp(pattern, flagsStr), replacement);
      } catch {
        replacedText = undefined;
      }
    }

    const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(2));

    return {
      isValid: true,
      matches,
      matchCount: matches.length,
      replacedText,
      executionTimeMs,
    };
  } catch (err) {
    const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(2));
    return {
      isValid: false,
      error: err instanceof Error ? err.message : "Invalid regular expression.",
      matches: [],
      matchCount: 0,
      executionTimeMs,
    };
  }
}
