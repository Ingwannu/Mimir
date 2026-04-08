"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { Locale } from "../../locale";

interface PublicSearchResult {
  question: string;
  results: Array<{
    knowledgeBaseSlug: string;
    entrySlug: string;
    title: string;
    excerpt: string;
    score: number;
  }>;
}

interface PublicAskResponse {
  answer: string;
  confidence: number;
  citations: string[];
  sources: Array<{
    knowledgeBaseSlug: string;
    entrySlug: string;
    title: string;
    excerpt: string;
  }>;
}

export function DocsUtility({
  locale,
  currentKnowledgeBaseSlug,
}: {
  locale: Locale;
  currentKnowledgeBaseSlug?: string;
}) {
  const isKo = locale === "ko";
  const [searchQuery, setSearchQuery] = useState("");
  const [askQuery, setAskQuery] = useState("");
  const [searchResult, setSearchResult] = useState<PublicSearchResult | null>(null);
  const [askResult, setAskResult] = useState<PublicAskResponse | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function runSearch() {
    const response = await fetch("/api/proxy/v1/public/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        question: searchQuery,
        knowledgeBaseSlugs: currentKnowledgeBaseSlug ? [currentKnowledgeBaseSlug] : [],
      }),
    });

    if (!response.ok) {
      throw new Error(isKo ? "문서 검색에 실패했습니다." : "Search failed.");
    }

    setSearchResult((await response.json()) as PublicSearchResult);
  }

  async function runAsk() {
    const response = await fetch("/api/proxy/v1/public/ask", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        question: askQuery,
        knowledgeBaseSlugs: currentKnowledgeBaseSlug ? [currentKnowledgeBaseSlug] : [],
      }),
    });

    if (!response.ok) {
      throw new Error(isKo ? "문서 질문에 실패했습니다." : "Ask failed.");
    }

    setAskResult((await response.json()) as PublicAskResponse);
  }

  return (
    <div className="docs-tools">
      <section className="docs-tool-card">
        <div className="card-header">
          <h3>{isKo ? "문서 검색" : "Search docs"}</h3>
          <span className="card-meta">{isKo ? "공개 문서" : "Public docs"}</span>
        </div>
        <label className="field">
          <span>{isKo ? "질문 또는 키워드" : "Question or keyword"}</span>
          <input
            className="input"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={
              isKo
                ? "예: 환불 규정, API 키 설정, 서버 이전"
                : "Ex: refund, API key setup, migration"
            }
            value={searchQuery}
          />
        </label>
        <button
          className="button"
          disabled={isPending || !searchQuery.trim()}
          onClick={() => {
            setError("");
            startTransition(async () => {
              try {
                await runSearch();
              } catch (nextError) {
                setError(
                  nextError instanceof Error
                    ? nextError.message
                    : isKo
                      ? "문서 검색 중 오류가 발생했습니다."
                      : "Search failed.",
                );
              }
            });
          }}
          type="button"
        >
          {isKo ? "검색" : "Search"}
        </button>

        {searchResult?.results.length ? (
          <div className="docs-result-list">
            {searchResult.results.slice(0, 6).map((result) => (
              <Link
                key={`${result.knowledgeBaseSlug}-${result.entrySlug}`}
                className="docs-result-card"
                href={`/docs/${result.knowledgeBaseSlug}/${result.entrySlug}`}
              >
                <strong>{result.title}</strong>
                <span>{result.excerpt}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="docs-tool-card">
        <div className="card-header">
          <h3>{isKo ? "문서에 질문하기" : "Ask docs"}</h3>
          <span className="card-meta">{isKo ? "AI 응답" : "AI answer"}</span>
        </div>
        <label className="field">
          <span>{isKo ? "질문" : "Question"}</span>
          <textarea
            className="textarea"
            onChange={(event) => setAskQuery(event.target.value)}
            placeholder={
              isKo
                ? "예: 이 서비스의 환불 기한은 어떻게 되나요?"
                : "Ex: How long do I have to ask for a refund?"
            }
            rows={4}
            value={askQuery}
          />
        </label>
        <button
          className="button button-secondary"
          disabled={isPending || !askQuery.trim()}
          onClick={() => {
            setError("");
            startTransition(async () => {
              try {
                await runAsk();
              } catch (nextError) {
                setError(
                  nextError instanceof Error
                    ? nextError.message
                    : isKo
                      ? "문서 질문 중 오류가 발생했습니다."
                      : "Ask failed.",
                );
              }
            });
          }}
          type="button"
        >
          {isKo ? "질문하기" : "Ask"}
        </button>

        {askResult ? (
          <div className="docs-answer-card">
            <strong>
              {isKo ? "답변" : "Answer"} · {askResult.confidence.toFixed(2)}
            </strong>
            <p>{askResult.answer}</p>
            {askResult.sources.length ? (
              <div className="docs-result-list">
                {askResult.sources.slice(0, 4).map((source) => (
                  <Link
                    key={`${source.knowledgeBaseSlug}-${source.entrySlug}`}
                    className="docs-result-card"
                    href={`/docs/${source.knowledgeBaseSlug}/${source.entrySlug}`}
                  >
                    <strong>{source.title}</strong>
                    <span>{source.excerpt}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="notice notice-error">{error}</p> : null}
      </section>
    </div>
  );
}
