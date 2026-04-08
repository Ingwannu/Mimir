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
                {isKo ? "깔끔하게 정리된 공개 문서와 빠른 검색" : "Structured public docs with fast search"}
              </span>
            </div>
          </Link>
        </div>

        <form action="/docs/search" className="docs-top-search" method="GET">
          <input
            className="input"
            name="q"
            placeholder={isKo ? "문서 검색..." : "Search docs..."}
            type="search"
          />
        </form>

        <div className="docs-topbar-actions">
          <Link className="docs-admin-link" href="/">
            {isKo ? "관리자 콘솔" : "Admin"}
          </Link>
          <LanguageToggle locale={locale} />
        </div>
      </header>

      <main className="content">
        <div className="content-frame docs-content-frame">{children}</div>
      </main>
    </div>
  );
}
