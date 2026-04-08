import Link from "next/link";

import { LanguageToggle } from "../components/language-toggle";
import { getLocale } from "../locale-server";

export default async function DocsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const isKo = locale === "ko";

  return (
    <div className="shell docs-shell-page">
      <header className="docs-topbar">
        <div className="brand-block">
          <Link className="brand-row" href="/docs">
            <img
              alt="Mimir logo"
              className="brand-logo"
              height={32}
              src="/mimir.svg"
              width={32}
            />
            <div className="brand-text">
              <span className="brand">Mimir Docs</span>
              <span className="brand-subtitle">
                {isKo ? "공개 문서와 검색" : "Public docs and search"}
              </span>
            </div>
          </Link>
        </div>

        <div className="docs-topbar-actions">
          <Link className="button button-secondary small" href="/">
            {isKo ? "관리자 콘솔" : "Admin"}
          </Link>
          <LanguageToggle locale={locale} />
        </div>
      </header>

      <main className="content">
        <div className="content-frame">{children}</div>
      </main>
    </div>
  );
}
