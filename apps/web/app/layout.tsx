import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";

import { logoutAction } from "./actions";
import { getCurrentUser } from "./auth";
import { LanguageToggle } from "./components/language-toggle";
import { TopNav } from "./components/top-nav";
import { getLocale } from "./locale-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "wickedhostbotai",
  description: "Self-hosted Discord support RAG scaffold",
};

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUser();
  const locale = await getLocale();
  const isKo = locale === "ko";

  return (
    <html className={`${sans.variable} ${mono.variable}`} lang={locale}>
      <body>
        <div className="shell">
          <header className="topbar">
            <div className="brand-block">
              <Link className="brand" href="/">
                wickedhostbotai
              </Link>
              <p className="lede">
                {isKo
                  ? "Postgres를 원장으로, Qdrant를 검색 인덱스로 사용하는 Discord 지원 RAG 콘솔입니다."
                  : "Discord support RAG with Postgres as ledger and Qdrant as index."}
              </p>
            </div>
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
          <TopNav locale={locale} />
          <main className="content">
            <div className="content-frame">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
