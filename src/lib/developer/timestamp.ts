/**
 * Pure Unix timestamp & date conversion engine.
 * Independent of React or UI frameworks.
 * 100% in-browser client-side execution.
 */

export type TimestampUnit = "seconds" | "milliseconds" | "microseconds";

export interface FormattedDateBreakdown {
  iso: string;
  utc: string;
  local: string;
  rfc2822: string;
  relative: string;
  timezone: string;
  dayOfWeek: string;
  dayOfYear: number;
  weekNumber: number;
  isLeapYear: boolean;
  epochSeconds: number;
  epochMilliseconds: number;
}

export interface TimestampParseResult {
  isValid: boolean;
  error?: string;
  date?: Date;
  detectedUnit?: TimestampUnit;
  breakdown?: FormattedDateBreakdown;
}

/**
 * Calculates day of the year (1-366)
 */
export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Calculates ISO week number (1-53)
 */
export function getWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * Checks if year is leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Generates relative time string ("5 minutes ago" / "in 3 hours")
 */
export function formatRelativeTime(targetDate: Date, baseDate = new Date()): string {
  const diffMs = targetDate.getTime() - baseDate.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const isFuture = diffSec > 0;
  const absSec = Math.abs(diffSec);

  if (absSec < 5) return "just now";
  if (absSec < 60) return isFuture ? `in ${absSec} seconds` : `${absSec} seconds ago`;

  const absMin = Math.round(absSec / 60);
  if (absMin < 60) return isFuture ? `in ${absMin} minute${absMin === 1 ? "" : "s"}` : `${absMin} minute${absMin === 1 ? "" : "s"} ago`;

  const absHours = Math.round(absMin / 60);
  if (absHours < 24) return isFuture ? `in ${absHours} hour${absHours === 1 ? "" : "s"}` : `${absHours} hour${absHours === 1 ? "" : "s"} ago`;

  const absDays = Math.round(absHours / 24);
  if (absDays < 30) return isFuture ? `in ${absDays} day${absDays === 1 ? "" : "s"}` : `${absDays} day${absDays === 1 ? "" : "s"} ago`;

  const absMonths = Math.round(absDays / 30);
  if (absMonths < 12) return isFuture ? `in ${absMonths} month${absMonths === 1 ? "" : "s"}` : `${absMonths} month${absMonths === 1 ? "" : "s"} ago`;

  const absYears = Math.round(absDays / 365);
  return isFuture ? `in ${absYears} year${absYears === 1 ? "" : "s"}` : `${absYears} year${absYears === 1 ? "" : "s"} ago`;
}

/**
 * Converts a Date instance into a comprehensive formatted breakdown.
 */
export function createDateBreakdown(date: Date): FormattedDateBreakdown {
  const epochMilliseconds = date.getTime();
  const epochSeconds = Math.floor(epochMilliseconds / 1000);

  let timezone = "Local";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
  } catch {
    // fallback
  }

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return {
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: `${date.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })} ${date.toLocaleTimeString()}`,
    rfc2822: date.toUTCString(),
    relative: formatRelativeTime(date),
    timezone,
    dayOfWeek: daysOfWeek[date.getDay()],
    dayOfYear: getDayOfYear(date),
    weekNumber: getWeekNumber(date),
    isLeapYear: isLeapYear(date.getFullYear()),
    epochSeconds,
    epochMilliseconds,
  };
}

/**
 * Parses numeric epoch input with unit auto-detection.
 */
export function parseTimestampInput(
  rawInput: string | number,
  specifiedUnit?: TimestampUnit
): TimestampParseResult {
  const str = String(rawInput).trim();
  if (!str) {
    return { isValid: false, error: "Please enter a timestamp number." };
  }

  // Remove potential quotes or whitespace
  const num = Number(str.replace(/,/g, ""));
  if (isNaN(num)) {
    return { isValid: false, error: "Invalid numeric timestamp." };
  }

  let unit: TimestampUnit = specifiedUnit || "seconds";

  if (!specifiedUnit) {
    const digitCount = Math.floor(Math.abs(num)).toString().length;
    if (digitCount >= 15) {
      unit = "microseconds";
    } else if (digitCount >= 12) {
      unit = "milliseconds";
    } else {
      unit = "seconds";
    }
  }

  let epochMillis: number;
  if (unit === "microseconds") {
    epochMillis = Math.floor(num / 1000);
  } else if (unit === "milliseconds") {
    epochMillis = Math.floor(num);
  } else {
    epochMillis = Math.floor(num * 1000);
  }

  const date = new Date(epochMillis);
  if (isNaN(date.getTime())) {
    return { isValid: false, error: "Timestamp value is out of acceptable date bounds." };
  }

  return {
    isValid: true,
    date,
    detectedUnit: unit,
    breakdown: createDateBreakdown(date),
  };
}

/**
 * Parses a date/time string into a Date object and timestamp breakdown.
 */
export function parseDateString(dateStr: string): TimestampParseResult {
  const trimmed = dateStr.trim();
  if (!trimmed) {
    return { isValid: false, error: "Please enter a valid date or ISO string." };
  }

  const parsed = Date.parse(trimmed);
  if (isNaN(parsed)) {
    return {
      isValid: false,
      error: "Unable to parse date string. Try standard formats like '2026-09-15T12:00:00Z' or 'Sep 15, 2026'.",
    };
  }

  const date = new Date(parsed);
  return {
    isValid: true,
    date,
    breakdown: createDateBreakdown(date),
  };
}
