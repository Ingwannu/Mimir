"use client";

import { useEffect, useState, useTransition } from "react";

import {
  apiFetch,
  type KnowledgeBaseRecord,
  type QueryPreviewRecord,
} from "./api-client";
import type { Locale } from "../locale";

export function QueryLab({ locale }: { locale: Locale }) {
  const isKo = locale === "ko";
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseRecord[]>([]);
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<string[]>(
    [],
  );
  const [question, setQuestion] = useState(
    isKo
      ? "환불은 구매 후 며칠 안에 요청할 수 있나요?"
      : "How long do I have to ask for a refund?",
  );
  const [preview, setPreview] = useState<QueryPreviewRecord | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    void loadKnowledgeBases();
  }, []);

  async function loadKnowledgeBases() {
    try {
      const next = await apiFetch<KnowledgeBaseRecord[]>("/v1/admin/kbs");
      setKnowledgeBases(next);
      if (next[0]) {
        setSelectedKnowledgeBaseIds([next[0].id]);
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    }
  }

  return (
    <div className="stack-page">
      <section className="stack">
        <div className="card-header">
          <h2>{isKo ? "질문 미리보기" : "Preview a question"}</h2>
          <span className="card-meta">{isKo ? "RAG 검사" : "RAG inspection"}</span>
        </div>

        <label className="field">
          <span>{isKo ? "질문" : "Question"}</span>
          <textarea
            className="textarea"
            onChange={(event) => setQuestion(event.target.value)}
            rows={4}
            value={question}
          />
        </label>

        <div className="field">
          <span>{isKo ? "지식 베이스" : "Knowledge bases"}</span>
          <div className="pill-row">
            {knowledgeBases.map((kb) => {
              const active = selectedKnowledgeBaseIds.includes(kb.id);

              return (
                <button
                  key={kb.id}
                  className={`pill-button ${active ? "is-active" : ""}`}
                  onClick={() =>
                    setSelectedKnowledgeBaseIds((current) =>
                      current.includes(kb.id)
                        ? current.filter((value) => value !== kb.id)
                        : [...current, kb.id],
                    )
                  }
                  type="button"
                >
                  {kb.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="button-row">
          <button
            className="button"
            disabled={isPending}
            onClick={() => {
              setError("");
              startTransition(async () => {
                try {
                  const nextPreview = await apiFetch<QueryPreviewRecord>(
                    "/v1/query/preview",
                    {
                      method: "POST",
                      body: JSON.stringify({
                        workspaceId: "workspace_demo",
                        question,
                        knowledgeBaseIds: selectedKnowledgeBaseIds,
                      }),
                    },
                  );
                  setPreview(nextPreview);
                } catch (nextError) {
                  setError(getErrorMessage(nextError));
                }
              });
            }}
            type="button"
          >
            {isKo ? "미리보기 실행" : "Run preview"}
          </button>
        </div>
      </section>

      {error ? <p className="notice notice-error">{error}</p> : null}

      {preview ? (
        <section className="dashboard-grid">
          <section className="stack">
            <div className="card-header">
              <h2>{isKo ? "구조화된 답변" : "Structured answer"}</h2>
              <span className="card-meta">
                {isKo ? "신뢰도" : "confidence"} {preview.answer.confidence.toFixed(2)}
              </span>
            </div>
            <p className="notice">{preview.answer.answer}</p>
            <div className="pill-row">
              {preview.answer.citations.map((citation) => (
                <span key={citation} className="pill">
                  {citation}
                </span>
              ))}
            </div>
          </section>

          <section className="stack">
            <div className="card-header">
              <h2>{isKo ? "프롬프트" : "Prompt"}</h2>
              <span className="card-meta">
                {preview.hits.length} {isKo ? "개 hit" : "hits"}
              </span>
            </div>
            <pre>{preview.prompt}</pre>
          </section>
        </section>
      ) : null}

      {preview?.hits.length ? (
        <section className="stack">
          <div className="card-header">
            <h2>{isKo ? "검색된 청크" : "Retrieved chunks"}</h2>
            <span className="card-meta">
              {preview.hits.length} {isKo ? "개 결과" : "results"}
            </span>
          </div>
          <div className="stack compact">
            {preview.hits.map((hit) => (
              <div key={hit.chunkId} className="list-card static">
                <strong>
                  {hit.chunkId} - {hit.score.toFixed(3)}
                </strong>
                <span>{hit.content}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
