"use client";

import { useEffect, useState, useTransition } from "react";

import {
  apiFetch,
  type AnalyticsRecord,
  type JobRecord,
  type QueryLogRecord,
} from "./api-client";
import type { Locale } from "../locale";

export function JobsConsole({ locale }: { locale: Locale }) {
  const isKo = locale === "ko";
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [logs, setLogs] = useState<QueryLogRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRecord | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  async function refresh() {
    try {
      const [nextJobs, nextLogs, nextAnalytics] = await Promise.all([
        apiFetch<JobRecord[]>("/v1/admin/jobs"),
        apiFetch<QueryLogRecord[]>("/v1/admin/logs"),
        apiFetch<AnalyticsRecord>("/v1/admin/analytics"),
      ]);

      setJobs(nextJobs);
      setLogs(nextLogs);
      setAnalytics(nextAnalytics);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    }
  }

  return (
    <div className="stack-page">
      {analytics ? (
        <section className="stat-strip">
          <div className="card stat-card">
            <strong>{analytics.queryCount}</strong>
            <span>{isKo ? "전체 질의" : "Total queries"}</span>
          </div>
          <div className="card stat-card">
            <strong>{analytics.handoffCount}</strong>
            <span>{isKo ? "사람 인계" : "Human handoffs"}</span>
          </div>
          <div className="card stat-card">
            <strong>{(analytics.handoffRate * 100).toFixed(1)}%</strong>
            <span>{isKo ? "인계 비율" : "Handoff rate"}</span>
          </div>
        </section>
      ) : null}

      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="dashboard-grid">
        <section className="stack">
          <div className="card-header">
            <h2>{isKo ? "인덱싱 작업" : "Index jobs"}</h2>
            <span className="card-meta">
              {jobs.length} {isKo ? "개 최근 작업" : "recent"}
            </span>
          </div>

          <div className="stack compact">
            {jobs.map((job) => (
              <div key={job.id} className="list-card static">
                <strong>
                  {formatJobType(job.jobType, isKo)} - {formatJobStatus(job.status, isKo)}
                </strong>
                <span>
                  {isKo ? "시도 횟수" : "attempts"} {job.attempts}
                  {job.entryId ? ` - ${isKo ? "엔트리" : "entry"} ${job.entryId}` : ""}
                </span>
                {job.error ? <span className="error-copy">{job.error}</span> : null}
                {job.status === "failed" ? (
                  <button
                    className="button button-secondary small"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await apiFetch(`/v1/admin/jobs/${job.id}/retry`, {
                            method: "POST",
                            body: JSON.stringify({}),
                          });
                          await refresh();
                        } catch (nextError) {
                          setError(getErrorMessage(nextError));
                        }
                      });
                    }}
                    type="button"
                  >
                    {isKo ? "재시도" : "Retry"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="stack">
          <div className="card-header">
            <h2>{isKo ? "최근 질의 로그" : "Recent query logs"}</h2>
            <span className="card-meta">
              {logs.length} {isKo ? "개 최근 로그" : "recent"}
            </span>
          </div>
          <div className="stack compact">
            {logs.map((log) => (
              <div key={log.id} className="list-card static">
                <strong>{log.question}</strong>
                <span>
                  {log.answer ?? (isKo ? "저장된 답변 없음" : "No answer stored")} -{" "}
                  {typeof log.confidence === "number"
                    ? log.confidence.toFixed(2)
                    : isKo
                      ? "없음"
                      : "n/a"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function formatJobType(jobType: string, isKo: boolean) {
  if (!isKo) {
    return jobType;
  }

  switch (jobType) {
    case "ingest_text":
      return "텍스트 수집";
    case "ingest_file":
      return "파일 수집";
    case "reindex_item":
      return "엔트리 재색인";
    case "reindex_kb":
      return "KB 재색인";
    case "delete_item_vectors":
      return "벡터 삭제";
    case "full_reembed":
      return "전체 재임베딩";
    default:
      return jobType;
  }
}

function formatJobStatus(status: string, isKo: boolean) {
  if (!isKo) {
    return status;
  }

  switch (status) {
    case "queued":
      return "대기";
    case "processing":
      return "처리 중";
    case "failed":
      return "실패";
    case "done":
      return "완료";
    default:
      return status;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
