export type Locale = "en" | "ko";

export const LOCALE_COOKIE = "mimir_locale";

export function resolveLocale(value: string | undefined): Locale {
  return value === "ko" ? "ko" : "en";
}
