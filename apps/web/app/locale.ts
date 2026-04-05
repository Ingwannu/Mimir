export type Locale = "en" | "ko";

export const LOCALE_COOKIE = "wickedhostbotai_locale";

export function resolveLocale(value: string | undefined): Locale {
  return value === "ko" ? "ko" : "en";
}
