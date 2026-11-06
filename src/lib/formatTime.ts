const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function toDate(iso: string | number | Date): Date {
  return iso instanceof Date ? iso : new Date(iso);
}

/**
 * Locale-aware relative time ("2 hours ago" / "há 2 horas"), matching the
 * amounts the UI used to compute inline. `locale` comes from `useI18n()` so the
 * label follows the active language.
 */
export function relativeTime(
  iso: string | number | Date,
  locale: string,
  now: number = Date.now()
): string {
  const date = toDate(iso);
  if (Number.isNaN(date.getTime())) return "";
  const delta = date.getTime() - now;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const abs = Math.abs(delta);
  if (abs < MINUTE) return rtf.format(Math.round(delta / 1000), "second");
  if (abs < HOUR) return rtf.format(Math.round(delta / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(delta / HOUR), "hour");
  if (abs < WEEK) return rtf.format(Math.round(delta / DAY), "day");
  if (abs < MONTH) return rtf.format(Math.round(delta / WEEK), "week");
  if (abs < YEAR) return rtf.format(Math.round(delta / MONTH), "month");
  return rtf.format(Math.round(delta / YEAR), "year");
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, fmt);
  }
  return fmt;
}

/** Day + short month: "Nov 5" / "5 de nov." */
export function shortDate(iso: string | number | Date, locale: string): string {
  const date = toDate(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatter(locale, { day: "numeric", month: "short" }).format(date);
}

/** Day + short month + year: "Nov 5, 2026" / "5 de nov. de 2026" */
export function mediumDate(iso: string | number | Date, locale: string): string {
  const date = toDate(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatter(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** Medium date + short time: "Nov 5, 2026, 9:22 PM" / "5 de nov. de 2026, 21:22" */
export function dateTime(iso: string | number | Date, locale: string): string {
  const date = toDate(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatter(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
