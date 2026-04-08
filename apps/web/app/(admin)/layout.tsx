import Image from "next/image";
import type { Metadata } from "next";

import { logoutAction } from "../actions";
import { getCurrentUser } from "../auth";
import { LanguageToggle } from "../components/language-toggle";
import { TopNav } from "../components/top-nav";
import { getLocale } from "../locale-server";

export const metadata: Metadata = {
  title: "Mimir Admin",
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUser();
  const locale = await getLocale();
  const isKo = locale === "ko";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-row">
            <Image
              alt="Mimir logo"
              className="brand-logo"
              height={32}
              priority
              src="/mimir.svg"
              width={32}
            />
            <div className="brand-text">
              <span className="brand">Mimir</span>
              <span className="brand-subtitle">
                {isKo
                  ? "Discord 지원 RAG 운영 콘솔"
                  : "Discord support RAG operator console"}
              </span>
            </div>
          </div>
        </div>

        <TopNav locale={locale} />

        <div className="topbar-actions">
          <LanguageToggle locale={locale} />
          {currentUser ? (
            <form action={logoutAction} className="topbar-auth">
              <span className="topbar-note">
                <span className="status-dot" />
                {currentUser.name}
              </span>
              <button className="button button-secondary small" type="submit">
                {isKo ? "로그아웃" : "Log out"}
              </button>
            </form>
          ) : (
            <div className="topbar-note">
              <span className="status-dot" />
              {isKo ? "관리자 로그인이 필요합니다" : "Admin login required"}
            </div>
          )}
        </div>
      </header>

      <main className="content">
        <div className="content-frame">{children}</div>
      </main>
    </div>
  );
}
