import Image from "next/image";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";

import { logoutAction } from "./actions";
import { getCurrentUser } from "./auth";
import { LanguageToggle } from "./components/language-toggle";
import { TopNav } from "./components/top-nav";
import { getLocale } from "./locale-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mimir",
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
      </body>
    </html>
  );
}
