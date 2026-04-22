export const EASTERN_TIME_ZONE = "America/New_York" as const;

type DateInput = Date | string | number | null | undefined;

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

