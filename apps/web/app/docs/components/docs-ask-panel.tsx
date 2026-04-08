"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { Locale } from "../../locale";

interface PublicAskResponse {
  answer: string;
  confidence: number;
  needsHuman: boolean;
  sources: Array<{
    knowledgeBaseSlug: string;
    entrySlug: string;
    title: string;
    excerpt: string;
  }>;
}

export function DocsAskPanel({
  locale,
  knowledgeBaseSlug,
}: {
  locale: Locale;
  knowledgeBaseSlug?: string;
}) {
  const isKo = locale === "ko";
  const [question, setQuestion] = useState(
    isKo ? "이 문서 기준으로 핵심만 요약해줘" : "Summarize the key point of this doc",
  );
  const [result, setResult] = useState<PublicAskResponse | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <section className="docs-tool-card">
      <div className="card-header">
        <h3>{isKo ? "문서에 질문하기" : "Ask the docs"}</h3>
        <span className="card-meta">{isKo ? "공개 문서만 사용" : "Public docs only"}</span>
      </div>
      <textarea
        className="textarea"
        onChange={(event) => setQuestion(event.target.value)}
        rows={4}
        value={question}
      />
      <button
        className="button"
        disabled={isPending || !question.trim()}
        onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              const response = await fetch("/api/proxy/v1/public/ask", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  question,
                  knowledgeBaseSlugs: knowledgeBaseSlug ? [knowledgeBaseSlug] : [],
                }),
              });

              if (!response.ok) {
                throw new Error(`Request failed with ${response.status}`);
              }

              setResult((await response.json()) as PublicAskResponse);
            } catch (nextError) {
              setError(
                nextError instanceof Error ? nextError.message : "Unknown error",
              );
            }
          });
        }}
        type="button"
      >
        {isKo ? "질문하기" : "Ask"}
      </button>

      {error ? <p className="notice notice-error">{error}</p> : null}

      {result ? (
        <div className="docs-ask-result">
          <div className="docs-answer-card">
            <strong>
              {isKo ? "신뢰도" : "Confidence"} {result.confidence.toFixed(2)}
            </strong>
            <p>{result.answer}</p>
          </div>
          {result.sources.length ? (
            <div className="docs-result-list">
              {result.sources.slice(0, 4).map((source) => (
                <Link
                  key={`${source.knowledgeBaseSlug}-${source.entrySlug}`}
                  className="docs-result-link"
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
    </section>
  );
}
