import Link from "next/link";
import type { ReactNode } from "react";

import type { PublicDocsIndex } from "../../lib";
import type { Locale } from "../../locale";

export function DocsShell({
  locale,
  index,
  current,
  children,
  utility,
}: {
  locale: Locale;
  index: PublicDocsIndex;
  current?: {
    knowledgeBaseSlug?: string;
    entrySlug?: string;
  };
  children: ReactNode;
  utility?: ReactNode;
}) {
  const isKo = locale === "ko";
  const totalEntries = index.knowledgeBases.reduce(
    (sum, group) => sum + group.entries.length,
    0,
  );

  return (
    <div className="docs-layout">
      <aside className="docs-sidebar">
        <div className="docs-sidebar-header">
          <p className="eyebrow">{isKo ? "공개 문서" : "Public docs"}</p>
          <h2>Mimir Docs</h2>
          <p className="docs-sidebar-copy">
            {isKo
              ? "왼쪽에서 문서를 고르거나 검색으로 바로 찾을 수 있습니다."
              : "Pick a document from the left or jump directly with search."}
          </p>
        </div>

        <div className="docs-sidebar-meta">
          <div className="docs-sidebar-stat">
            <strong>{index.knowledgeBases.length}</strong>
            <span>{isKo ? "지식베이스" : "Knowledge bases"}</span>
          </div>
          <div className="docs-sidebar-stat">
            <strong>{totalEntries}</strong>
            <span>{isKo ? "공개 문서" : "Published docs"}</span>
          </div>
        </div>

        <form action="/docs/search" className="docs-search-form" method="GET">
          <input
            className="input"
            name="q"
            placeholder={isKo ? "문서 검색..." : "Search docs..."}
            type="search"
          />
          <button className="button button-secondary small" type="submit">
            {isKo ? "검색" : "Search"}
          </button>
        </form>

        <div className="docs-sidebar-home">
          <Link
            className={`docs-sidebar-link ${!current?.entrySlug ? "is-active" : ""}`}
            href="/docs"
          >
            <strong>{isKo ? "문서 홈" : "Docs home"}</strong>
            <small>{isKo ? "전체 문서와 지식베이스 보기" : "Browse all docs and knowledge bases"}</small>
          </Link>
        </div>

        <div className="docs-sidebar-groups">
          {index.knowledgeBases.map((group) => (
            <section key={group.knowledgeBaseId} className="docs-sidebar-group">
              <div className="docs-sidebar-group-head">
                <strong>{group.name}</strong>
                <small>
                  {group.entries.length} {isKo ? "문서" : "docs"}
                </small>
                {group.description ? <span>{group.description}</span> : null}
              </div>
              <div className="docs-sidebar-links">
                {group.entries.map((entry) => {
                  const active =
                    current?.knowledgeBaseSlug === group.slug &&
                    current?.entrySlug === entry.entrySlug;

                  return (
                    <Link
                      key={entry.entryId}
                      className={`docs-sidebar-link ${active ? "is-active" : ""}`}
                      href={`/docs/${group.slug}/${entry.entrySlug}`}
                    >
                      <strong>{entry.title}</strong>
                      {entry.category ? <small>{entry.category}</small> : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </aside>

      <section className="docs-content">{children}</section>

      <aside className="docs-utility">
        <div className="docs-utility-stack">
          <div className="docs-utility-header">
            <p className="eyebrow">{isKo ? "도구" : "Tools"}</p>
            <h3>{isKo ? "문서 도우미" : "Docs assistant"}</h3>
          </div>
          {utility}
        </div>
      </aside>
    </div>
  );
}
