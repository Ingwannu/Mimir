import Link from "next/link";

import { getLocale } from "../../locale-server";
import { getPublicDocsIndex, searchPublicDocs } from "../../lib";
import { DocsAskPanel } from "../components/docs-ask-panel";
import { DocsShell } from "../components/docs-shell";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams?: Promise<{
    q?: string;
  }>;
}

export default async function DocsSearchPage({ searchParams }: SearchPageProps) {
  const params = (await searchParams) ?? {};
  const [locale, docs] = await Promise.all([getLocale(), getPublicDocsIndex()]);
  const isKo = locale === "ko";
  const query = params.q?.trim() ?? "";
  const result = query
    ? await searchPublicDocs({
        question: query,
      })
    : null;

  return (
    <DocsShell index={docs ?? { knowledgeBases: [] }} locale={locale} utility={<DocsAskPanel locale={locale} />}>
      <div className="docs-home">
        <p className="eyebrow">{isKo ? "검색" : "Search"}</p>
        <h1>{isKo ? "문서 검색 결과" : "Search results"}</h1>
        <p>
          {query
            ? isKo
              ? `“${query}”에 대한 결과입니다.`
              : `Results for “${query}”.`
            : isKo
              ? "검색어를 입력하면 공개 문서에서 결과를 찾습니다."
              : "Enter a query to search across the public docs."}
        </p>

        {result?.results.length ? (
          <div className="docs-result-list">
            {result.results.map((item) => (
              <Link
                key={`${item.knowledgeBaseSlug}-${item.entrySlug}`}
                className="docs-result-link"
                href={`/docs/${item.knowledgeBaseSlug}/${item.entrySlug}`}
              >
                <strong>{item.title}</strong>
                <span>{item.excerpt}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="docs-result-card empty">
            <strong>{isKo ? "검색 결과 없음" : "No results"}</strong>
            <p>
              {query
                ? isKo
                  ? "공개 문서에서 일치하는 결과를 찾지 못했습니다."
                  : "No matching public docs were found."
                : isKo
                  ? "먼저 검색어를 입력하세요."
                  : "Enter a search query first."}
            </p>
          </div>
        )}
      </div>
    </DocsShell>
  );
}
