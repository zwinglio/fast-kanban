import { createI18n, type I18n } from "vue-i18n";
import en from "./locales/en";
import ptBR from "./locales/pt-BR";

/**
 * The message schema is derived from the English messages. pt-BR.ts is typed
 * against it, so a missing (or extra) pt-BR key fails `bunx vue-tsc --noEmit`.
 */
export type MessageSchema = typeof en;

/** Named date formats usable through `d(date, "key")` and `useI18n().d`. */
const dateFormats = {
  /** Day + short month: "Nov 5" / "5 de nov." */
  short: { day: "numeric", month: "short" },
  /** Day + short month + year: "Nov 5, 2026" / "5 de nov. de 2026" */
  medium: { day: "numeric", month: "short", year: "numeric" },
  /** Medium date + short time: "Nov 5, 2026, 9:22 PM" / "5 de nov. de 2026, 21:22" */
  long: { dateStyle: "medium", timeStyle: "short" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

/** Number formats usable through `n(value, "key")` and `useI18n().n`. */
const numberFormats = {
  decimal: { style: "decimal" },
  /** Grouped whole number: 999.999 (pt-BR) / 999,999 (en). */
  integer: { maximumFractionDigits: 0 },
} satisfies Record<string, Intl.NumberFormatOptions>;

// The factory's overloads infer a legacy (VueI18n) instance from `legacy: false`
// in this repo's TS setup; casting to the composition-mode I18n type keeps
// `i18n.global.locale` typed as a WritableComputedRef.
export const i18n = createI18n({
  legacy: false,
  // The real locale is applied by initLocale() in main.ts before mounting.
  locale: "en",
  fallbackLocale: "en",
  messages: { en, "pt-BR": ptBR },
  datetimeFormats: { en: dateFormats, "pt-BR": dateFormats },
  numberFormats: { en: numberFormats, "pt-BR": numberFormats },
}) as unknown as I18n<
  Record<string, MessageSchema>,
  Record<string, typeof dateFormats>,
  Record<string, typeof numberFormats>,
  "en" | "pt-BR",
  false
>;
