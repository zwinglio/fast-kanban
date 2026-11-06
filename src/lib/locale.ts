import { i18n } from "../i18n";

export type Locale = "en" | "pt-BR";

export interface LocaleOption {
  value: Locale;
  /** Shown in its own language, the way language pickers usually are. */
  label: string;
  /** Compact label for the toggle button. */
  short: string;
}

export const LOCALES: LocaleOption[] = [
  { value: "en", label: "English", short: "EN" },
  { value: "pt-BR", label: "Português (Brasil)", short: "PT" },
];

const STORAGE_KEY = "fk_locale";

/** The browser's preferred locale: Portuguese gets pt-BR, everything else en. */
export function detectLocale(): Locale {
  const tag = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return tag.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}

/** The locale to use on startup: the saved choice, else the browser's. */
export function getLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "pt-BR") return stored;
  } catch {
    // Storage blocked; fall back to the browser language.
  }
  return detectLocale();
}

/** Keeps the document language in sync so screen readers and CSS `:lang()` work. */
export function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale;
}

/** Persists the choice, switches the UI live, and updates <html lang>. */
export function setLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage blocked; the choice still applies for this session.
  }
  i18n.global.locale.value = locale;
  applyLocale(locale);
}

/** Applies the persisted (or browser) locale; call once on app startup. */
export function initLocale(): Locale {
  const locale = getLocale();
  i18n.global.locale.value = locale;
  applyLocale(locale);
  return locale;
}

/** The locale after which the toggle cycles. */
export function nextLocale(locale: Locale): Locale {
  const index = LOCALES.findIndex((option) => option.value === locale);
  return LOCALES[(index + 1) % LOCALES.length].value;
}
