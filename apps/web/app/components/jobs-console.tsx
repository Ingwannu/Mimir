"use client";

import { useEffect, useState, useTransition } from "react";

import {
  apiFetch,
  type AnalyticsRecord,
  type AnalyticsSeriesRecord,
  type JobRecord,
  type QueryLogRecord,
} from "./api-client";
import type { Locale } from "../locale";

export function JobsConsole({ locale }: { locale: Locale }) {
  const isKo = locale === "ko";
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [logs, setLogs] = useState<QueryLogRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRecord | null>(null);
  const [series, setSeries] = useState<AnalyticsSeriesRecord | null>(null);
  const [period, setPeriod] = useState<AnalyticsRecord["period"]>("7d");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void refresh(period);
    const timer = window.setInterval(() => {
      void refresh(period);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [period]);

  async function refresh(nextPeriod: AnalyticsRecord["period"]) {
    try {
      const [nextJobs, nextLogs, nextAnalytics, nextSeries] = await Promise.all([
        apiFetch<JobRecord[]>("/v1/admin/jobs"),
        apiFetch<QueryLogRecord[]>("/v1/admin/logs"),
        apiFetch<AnalyticsRecord>(`/v1/admin/analytics?period=${nextPeriod}`),
        apiFetch<AnalyticsSeriesRecord>(
          `/v1/admin/analytics/series?period=${nextPeriod}`,
        ),
      ]);

      setJobs(nextJobs);
      setLogs(nextLogs);
      setAnalytics(nextAnalytics);
      setSeries(nextSeries);
      setError("");
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    }
  }

  const latestLog = logs[0];
  const inputShare = getShare(
    analytics?.inputTokens ?? 0,
    analytics?.totalTokens ?? 0,
  );
  const outputShare = getShare(
    analytics?.outputTokens ?? 0,
    analytics?.totalTokens ?? 0,
  );

  return (
    <div className="stack-page">
      {analytics ? (
        <section className="analytics-hero">
          <div className="analytics-hero-copy">
            <span className="eyebrow">
              {isKo ? "Usage overview" : "Usage overview"}
            </span>
            <h2>{isKo ? "토큰 사용량 대시보드" : "Token usage dashboard"}</h2>
            <p>
              {isKo
                ? `${formatPeriod(period, true)} 기준으로 질문량, 토큰 소비, 최근 처리 흐름을 한 화면에서 봅니다.`
                : `Track volume, token spend, and recent runtime flow for the selected period in one place.`}
            </p>
          </div>

          <div className="analytics-hero-controls">
            <div className="pill-row">
              {(["24h", "7d", "30d", "all"] as const).map((option) => (
                <button
                  key={option}
                  className={`pill-button ${period === option ? "is-active" : ""}`}
                  onClick={() => setPeriod(option)}
                  type="button"
                >
                  {formatPeriod(option, isKo)}
                </button>
              ))}
            </div>

            <div className="analytics-mini-stats">
              <div>
                <span>{isKo ? "총 토큰" : "Total tokens"}</span>
                <strong>{formatNumber(analytics.totalTokens)}</strong>
              </div>
              <div>
                <span>{isKo ? "질의 수" : "Queries"}</span>
                <strong>{formatNumber(analytics.queryCount)}</strong>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {error ? <p className="notice notice-error">{error}</p> : null}

      {analytics ? (
        <section className="analytics-summary-grid">
          <article className="analytics-summary-card analytics-summary-card-primary">
            <span className="analytics-card-label">
              {isKo ? "총 토큰 소비" : "Total token spend"}
            </span>
            <strong>{formatNumber(analytics.totalTokens)}</strong>
            <p>
              {isKo
                ? `${formatPeriod(period, true)} 동안 집계된 전체 입력/출력 합계`
                : `Combined input and output tokens captured during ${formatPeriod(period, false)}.`}
            </p>
          </article>

          <article className="analytics-summary-card">
            <span className="analytics-card-label">
              {isKo ? "입력 토큰" : "Input tokens"}
            </span>
            <strong>{formatNumber(analytics.inputTokens)}</strong>
            <p>{formatPercent(inputShare)}</p>
          </article>

          <article className="analytics-summary-card">
            <span className="analytics-card-label">
              {isKo ? "출력 토큰" : "Output tokens"}
            </span>
            <strong>{formatNumber(analytics.outputTokens)}</strong>
            <p>{formatPercent(outputShare)}</p>
          </article>

          <article className="analytics-summary-card">
            <span className="analytics-card-label">
              {isKo ? "질의당 평균" : "Average per query"}
            </span>
            <strong>{formatNumber(Math.round(analytics.averageTotalTokensPerQuery))}</strong>
            <p>{isKo ? "총 토큰 기준" : "Based on total tokens"}</p>
          </article>

          <article className="analytics-summary-card">
            <span className="analytics-card-label">
              {isKo ? "사람 인계" : "Human handoffs"}
            </span>
            <strong>{formatNumber(analytics.handoffCount)}</strong>
            <p>
              {isKo ? "인계 비율 " : "Rate "}
              {formatPercent(analytics.handoffRate)}
            </p>
          </article>

          <article className="analytics-summary-card">
            <span className="analytics-card-label">
              {isKo ? "가장 최근 질의" : "Latest query"}
            </span>
            <strong>{latestLog ? formatRelativeTime(latestLog.createdAt, isKo) : "-"}</strong>
            <p>{latestLog?.question ?? (isKo ? "아직 로그가 없습니다." : "No logs yet.")}</p>
          </article>
        </section>
      ) : null}

      {analytics && series ? (
        <section className="analytics-visual-grid">
          <article className="stack analytics-chart-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">
                  {isKo ? "Token trend" : "Token trend"}
                </span>
                <h2>{isKo ? "기간별 사용 흐름" : "Usage over time"}</h2>
              </div>
              <span className="card-meta">
                {isKo ? "선택한 기간 기준" : "Based on selected period"}
              </span>
            </div>
            <p>
              {isKo
                ? "각 구간마다 소비된 총 토큰을 보여줍니다."
                : "Shows total tokens consumed in each time bucket."}
            </p>
            <UsageTrendChart buckets={series.buckets} isKo={isKo} />
          </article>

          <article className="stack analytics-composition-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">
                  {isKo ? "Mix" : "Mix"}
                </span>
                <h2>{isKo ? "입력 / 출력 구성" : "Input / output mix"}</h2>
              </div>
            </div>
            <p>
              {isKo
                ? "이번 기간 동안 어떤 쪽에서 토큰 소비가 컸는지 바로 보입니다."
                : "See whether input or output is driving most of the token cost."}
            </p>
            <div className="token-mix-bar" aria-hidden="true">
              <div
                className="token-mix-segment token-mix-input"
                style={{ width: `${inputShare}%` }}
              />
              <div
                className="token-mix-segment token-mix-output"
                style={{ width: `${outputShare}%` }}
              />
            </div>
            <div className="token-mix-legend">
              <div className="token-mix-item">
                <span className="token-dot token-dot-input" />
                <div>
                  <strong>{isKo ? "입력" : "Input"}</strong>
                  <span>
                    {formatNumber(analytics.inputTokens)} · {formatPercent(inputShare)}
                  </span>
                </div>
              </div>
              <div className="token-mix-item">
                <span className="token-dot token-dot-output" />
                <div>
                  <strong>{isKo ? "출력" : "Output"}</strong>
                  <span>
                    {formatNumber(analytics.outputTokens)} · {formatPercent(outputShare)}
                  </span>
                </div>
              </div>
            </div>
            <div className="analytics-kicker-grid">
              <div className="analytics-kicker-card">
                <span>{isKo ? "최대 버킷" : "Peak bucket"}</span>
                <strong>{formatNumber(getPeakBucket(series.buckets).totalTokens)}</strong>
              </div>
              <div className="analytics-kicker-card">
                <span>{isKo ? "활성 구간" : "Active buckets"}</span>
                <strong>{formatNumber(countActiveBuckets(series.buckets))}</strong>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      <section className="dashboard-grid analytics-detail-grid">
        <section className="stack analytics-log-panel">
          <div className="card-header">
            <div>
              <span className="eyebrow">
                {isKo ? "Recent queries" : "Recent queries"}
              </span>
              <h2>{isKo ? "최근 질의 로그" : "Recent query logs"}</h2>
            </div>
            <span className="card-meta">
              {logs.length} {isKo ? "개 최근 로그" : "recent"}
            </span>
          </div>
          <div className="stack compact">
            {logs.map((log) => (
              <article key={log.id} className="analytics-log-card">
                <div className="analytics-log-header">
                  <strong>{log.question}</strong>
                  <span className="pill">{formatRelativeTime(log.createdAt, isKo)}</span>
                </div>
                <p>
                  {log.answer ?? (isKo ? "저장된 답변 없음" : "No answer stored")}
                </p>
                <div className="analytics-log-meta">
                  <span className="pill">
                    {isKo ? "신뢰도" : "Confidence"}{" "}
                    {typeof log.confidence === "number"
                      ? log.confidence.toFixed(2)
                      : isKo
                        ? "없음"
                        : "n/a"}
                  </span>
                  <span className="pill">
                    {isKo ? "토큰" : "Tokens"}{" "}
                    {formatCompactTokens(log.totalTokens ?? 0)}
                  </span>
                  {log.answerModel ? <span className="pill">{log.answerModel}</span> : null}
                </div>
                <div className="analytics-log-breakdown">
                  <div>
                    <span>{isKo ? "입력" : "Input"}</span>
                    <strong>{formatNumber(log.inputTokens ?? 0)}</strong>
                  </div>
                  <div>
                    <span>{isKo ? "출력" : "Output"}</span>
                    <strong>{formatNumber(log.outputTokens ?? 0)}</strong>
                  </div>
                  <div>
                    <span>{isKo ? "총합" : "Total"}</span>
                    <strong>{formatNumber(log.totalTokens ?? 0)}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="stack analytics-job-panel">
          <div className="card-header">
            <div>
              <span className="eyebrow">
                {isKo ? "Indexing" : "Indexing"}
              </span>
              <h2>{isKo ? "인덱싱 작업" : "Index jobs"}</h2>
            </div>
            <span className="card-meta">
              {jobs.length} {isKo ? "개 최근 작업" : "recent"}
            </span>
          </div>

          <div className="stack compact">
            {jobs.map((job) => (
              <div key={job.id} className="analytics-job-card">
                <div className="analytics-job-header">
                  <strong>{formatJobType(job.jobType, isKo)}</strong>
                  <span className={`pill pill-status-${job.status}`}>
                    {formatJobStatus(job.status, isKo)}
                  </span>
                </div>
                <p>
                  {isKo ? "시도 횟수" : "Attempts"} {job.attempts}
                  {job.entryId ? ` · ${isKo ? "엔트리" : "Entry"} ${truncateId(job.entryId)}` : ""}
                </p>
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
                          await refresh(period);
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
      </section>
    </div>
  );
}

function UsageTrendChart({
  buckets,
  isKo,
}: {
  buckets: AnalyticsSeriesRecord["buckets"];
  isKo: boolean;
}) {
  const width = 760;
  const height = 260;
  const paddingX = 18;
  const paddingTop = 18;
  const paddingBottom = 40;
  const chartHeight = height - paddingTop - paddingBottom;
  const step = buckets.length > 1 ? (width - paddingX * 2) / (buckets.length - 1) : 0;
  const maxValue = Math.max(...buckets.map((bucket) => bucket.totalTokens), 1);

  const points = buckets.map((bucket, index) => {
    const x = paddingX + index * step;
    const y =
      paddingTop + chartHeight - (bucket.totalTokens / maxValue) * chartHeight;
    return { x, y, bucket };
  });

  const path = points
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${path} L ${points[points.length - 1]?.x ?? paddingX} ${height - paddingBottom} L ${points[0]?.x ?? paddingX} ${height - paddingBottom} Z`
      : "";

  return (
    <div className="trend-chart-shell">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="trend-chart"
        role="img"
        aria-label={
          isKo ? "기간별 총 토큰 사용량 그래프" : "Total token usage chart over time"
        }
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = paddingTop + chartHeight - chartHeight * ratio;
          return (
            <line
              key={ratio}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              className="trend-grid-line"
            />
          );
        })}
        {areaPath ? <path d={areaPath} className="trend-area" /> : null}
        {path ? <path d={path} className="trend-line" /> : null}
        {points.map(({ x, y, bucket }) => (
          <g key={`${bucket.label}-${x}`}>
            <circle cx={x} cy={y} r="4.5" className="trend-point" />
            <title>{`${bucket.label}: ${formatNumber(bucket.totalTokens)} tokens / ${bucket.queryCount} queries`}</title>
          </g>
        ))}
      </svg>
      <div className="trend-chart-labels">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="trend-chart-label">
            <span>{bucket.label}</span>
            <strong>{formatCompactTokens(bucket.totalTokens)}</strong>
          </div>
        ))}
      </div>
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

function formatPeriod(period: AnalyticsRecord["period"], isKo: boolean) {
  switch (period) {
    case "24h":
      return isKo ? "오늘" : "24h";
    case "7d":
      return isKo ? "7일" : "7d";
    case "30d":
      return isKo ? "30일" : "30d";
    case "all":
    default:
      return isKo ? "전체" : "All time";
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatCompactTokens(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return formatNumber(value);
}

function formatRelativeTime(value: string, isKo: boolean) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return isKo ? `${diffMinutes}분 전` : `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return isKo ? `${diffHours}시간 전` : `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return isKo ? `${diffDays}일 전` : `${diffDays}d ago`;
}

function truncateId(value: string) {
  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function getShare(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return (part / total) * 100;
}

function getPeakBucket(buckets: AnalyticsSeriesRecord["buckets"]) {
  return buckets.reduce(
    (peak, bucket) => (bucket.totalTokens > peak.totalTokens ? bucket : peak),
    buckets[0] ?? {
      label: "-",
      queryCount: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  );
}

function countActiveBuckets(buckets: AnalyticsSeriesRecord["buckets"]) {
  return buckets.filter((bucket) => bucket.queryCount > 0).length;
}
