"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "../locale";

const NAV_ITEMS = {
  en: [
    {
      href: "/",
      label: "Overview",
      description: "Status and high-level metrics",
    },
    {
      href: "/setup",
      label: "Setup",
      description: "Bootstrap the stack and defaults",
    },
    {
      href: "/knowledge",
      label: "Knowledge",
      description: "Manage KBs, entries, and versions",
    },
    {
      href: "/queries",
      label: "Queries",
      description: "Inspect retrieval and prompts",
    },
    {
      href: "/jobs",
      label: "Jobs",
      description: "Review indexing and logs",
    },
    {
      href: "/settings",
      label: "Settings",
      description: "Provider, Discord, and secrets",
    },
  ],
  ko: [
    {
      href: "/",
      label: "개요",
      description: "현재 상태와 핵심 지표",
    },
    {
      href: "/setup",
      label: "설정 시작",
      description: "초기 설정과 기본값 준비",
    },
    {
      href: "/knowledge",
      label: "지식",
      description: "KB, 엔트리, 버전 관리",
    },
    {
      href: "/queries",
      label: "질의",
      description: "검색 결과와 프롬프트 확인",
    },
    {
      href: "/jobs",
      label: "작업",
      description: "인덱싱 작업과 로그 확인",
    },
    {
      href: "/settings",
      label: "설정",
      description: "모델, Discord, 비밀키 관리",
    },
  ],
} as const;

export function TopNav({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? "/";
  const items = NAV_ITEMS[locale];

  return (
    <nav className="nav-grid">
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            className={`nav-card ${active ? "is-active" : ""}`}
            href={item.href}
          >
            <span className="nav-label">{item.label}</span>
            <span className="nav-description">{item.description}</span>
          </Link>
        );
      })}
    </nav>
  );
}
