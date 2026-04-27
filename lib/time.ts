export const EASTERN_TIME_ZONE = "America/New_York" as const;

type DateInput = Date | string | number | null | undefined;
type YyyyMmDd = `${number}-${string}-${string}`;

function toDate(value: DateInput): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateET(
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

export function formatDateTimeET(
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleString("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  });
}

export function formatYyyyMmDdET(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function getTodayYyyyMmDdET(now: Date = new Date()): string {
  return formatYyyyMmDdET(now);
}

/**
 * Parses `YYYY-MM-DD` to a Date at 12:00 UTC.
 * Using UTC noon avoids most cross-time-zone “previous/next day” edge cases.
 */
export function parseYyyyMmDdToUtcNoon(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export function shiftDaysYyyyMmDdET(value: string, daysDelta: number): string {
  const d = parseYyyyMmDdToUtcNoon(value);
  if (!d) return value;
  d.setUTCDate(d.getUTCDate() + daysDelta);
  return formatYyyyMmDdET(d) as YyyyMmDd;
}

