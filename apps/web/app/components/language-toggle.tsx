"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { LOCALE_COOKIE, type Locale } from "../locale";

export function LanguageToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setLocale(nextLocale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="lang-toggle" aria-label="Language switcher">
      <button
        className={`lang-button ${locale === "en" ? "is-active" : ""}`}
        disabled={isPending}
        onClick={() => setLocale("en")}
        type="button"
      >
        EN
      </button>
      <button
        className={`lang-button ${locale === "ko" ? "is-active" : ""}`}
        disabled={isPending}
        onClick={() => setLocale("ko")}
        type="button"
      >
        한국어
      </button>
    </div>
  );
}
