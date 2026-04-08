import Link from "next/link";

import { getPublicDocsIndex } from "../lib";
import { getLocale } from "../locale-server";
import { DocsAskPanel } from "./components/docs-ask-panel";
import { DocsShell } from "./components/docs-shell";

export const dynamic = "force-dynamic";

export default async function DocsIndexPage() {
  const [locale, docs] = await Promise.all([getLocale(), getPublicDocsIndex()]);
  const isKo = locale === "ko";

  if (!docs || docs.knowledgeBases.length === 0) {
    return (
      <div className="page">
        <section className="panel">
          <p className="eyebrow">{isKo ? "공개 문서" : "Public docs"}</p>
          <h2>{isKo ? "아직 공개 문서가 없습니다" : "No public docs yet"}</h2>
          <p>
            {isKo
              ? "관리자 콘솔에서 공개 상태의 문서를 추가하면 이곳에 자동으로 나타납니다."
              : "Published knowledge entries with public visibility will appear here automatically."}
          </p>
        </section>
      </div>
    );
  }

  return (
    <DocsShell index={docs} locale={locale} utility={<DocsAskPanel locale={locale} />}>
      <div className="docs-home">
        <p className="eyebrow">{isKo ? "문서 홈" : "Docs home"}</p>
        <h1>{isKo ? "Mimir 공개 문서" : "Mimir public docs"}</h1>
        <p>
          {isKo
            ? "왼쪽에서 문서를 고르거나 검색을 통해 원하는 정보를 바로 찾을 수 있습니다."
            : "Use the left navigation or search to jump directly to the document you need."}
        </p>

        <div className="docs-home-grid">
          {docs.knowledgeBases.map((group) => (
            <section key={group.knowledgeBaseId} className="docs-home-card">
              <h2>{group.name}</h2>
              <span>{group.description ?? (isKo ? "설명 없음" : "No description")}</span>
              <div className="docs-home-links">
                {group.entries.slice(0, 4).map((entry) => (
                  <Link
                    key={entry.entryId}
                    className="docs-inline-link"
                    href={`/docs/${group.slug}/${entry.entrySlug}`}
                  >
                    {entry.title}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </DocsShell>
  );
}
