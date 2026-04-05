import { getLocale } from "./locale-server";

export const dynamic = "force-dynamic";

async function getHealth() {
  const baseUrl = process.env.WEB_API_BASE_URL ?? "http://localhost:4000";

  try {
    const response = await fetch(`${baseUrl}/v1/health`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        detail: `API returned ${response.status}`,
      };
    }

    const payload = (await response.json()) as { ok: boolean };
    return {
      ok: payload.ok,
      detail: "API and backing services responded.",
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error ? error.message : "Unable to reach the API service.",
    };
  }
}

async function getSummary() {
  const baseUrl = process.env.WEB_API_BASE_URL ?? "http://localhost:4000";

  try {
    const response = await fetch(`${baseUrl}/v1/admin/dashboard`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Summary returned ${response.status}`);
    }

    return (await response.json()) as {
      knowledgeBaseCount: number;
      entryCount: number;
      queuedJobCount: number;
      queryCount: number;
      failedJobCount: number;
    };
  } catch {
    return {
      knowledgeBaseCount: 0,
      entryCount: 0,
      queuedJobCount: 0,
      queryCount: 0,
      failedJobCount: 0,
    };
  }
}

export default async function HomePage() {
  const [health, summary] = await Promise.all([getHealth(), getSummary()]);
  const locale = await getLocale();
  const isKo = locale === "ko";

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">{isKo ? "관리 콘솔" : "Admin shell"}</p>
        <h2>
          {isKo
            ? "Discord 지원, 원장 중심 지식 관리, 워커 기반 인덱싱"
            : "Discord support, ledger-first knowledge, worker-driven indexing"}
        </h2>
        <p>
          {isKo
            ? "이 콘솔은 모든 대시보드 변경을 Postgres에 기록하고, 파생 chunk와 embedding만 Qdrant에 넣으며, Discord 봇은 API만 호출하는 얇은 입출력 계층으로 유지합니다."
            : "This build keeps every dashboard edit in Postgres, pushes derived chunks into Qdrant, and leaves the Discord bot as a thin transport layer that only calls the API."}
        </p>
        <div className={`health ${health.ok ? "" : "offline"}`}>
          <span className="status-dot" />
          {health.ok
            ? isKo
              ? "스택 정상"
              : "Stack reachable"
            : isKo
              ? "스택 연결 안 됨"
              : "Stack not reachable yet"}
          : {health.detail}
        </div>
        <div className="hero-grid">
          <div className="metric">
            <strong>{summary.knowledgeBaseCount}</strong>
            <p>{isKo ? "지식 베이스" : "Knowledge bases"}</p>
          </div>
          <div className="metric">
            <strong>{summary.entryCount}</strong>
            <p>{isKo ? "지식 엔트리" : "Knowledge entries"}</p>
          </div>
          <div className="metric">
            <strong>{summary.queuedJobCount}</strong>
            <p>{isKo ? "대기 중 작업" : "Queued jobs"}</p>
          </div>
          <div className="metric">
            <strong>{summary.queryCount}</strong>
            <p>{isKo ? "기록된 질의" : "Logged queries"}</p>
          </div>
        </div>
      </section>

      <section className="card-grid">
        <div className="card">
          <strong>{isKo ? "초기 설정" : "Setup flow"}</strong>
          <p>
            {isKo
              ? "첫 지식 베이스를 공개하기 전에 provider, 모델, Discord 기본값을 먼저 저장하세요."
              : "Save provider, model, and Discord defaults before publishing the first KB."}
          </p>
        </div>
        <div className="card">
          <strong>{isKo ? "버전 안전 CRUD" : "Version-safe CRUD"}</strong>
          <p>
            {isKo
              ? "수정 시 먼저 새 버전을 만들고, 워커가 인덱싱을 마친 뒤 active version을 교체합니다."
              : "Edits create new entry versions first, then the worker swaps active versions after indexing."}
          </p>
        </div>
        <div className="card">
          <strong>{isKo ? "질의 가시성" : "Query observability"}</strong>
          <p>
            {isKo
              ? "검색된 chunk, 프롬프트 조합, 답변 신뢰도, handoff 여부를 미리 확인할 수 있습니다."
              : "Preview retrieved chunks, prompt assembly, answer confidence, and handoff posture."}
          </p>
        </div>
        <div className="card">
          <strong>{isKo ? "확인 필요 작업" : "Attention queue"}</strong>
          <p>
            {isKo
              ? `현재 실패한 작업 ${summary.failedJobCount}건이 검토 또는 재시도를 기다리고 있습니다.`
              : `${summary.failedJobCount} failed jobs currently need operator review or retry.`}
          </p>
        </div>
      </section>
    </div>
  );
}
