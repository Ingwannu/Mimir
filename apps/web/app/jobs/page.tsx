import { JobsConsole } from "../components/jobs-console";
import { getLocale } from "../locale-server";

export default async function JobsPage() {
  const locale = await getLocale();
  const isKo = locale === "ko";
  return (
    <div className="page">
      <section className="panel">
        <p className="eyebrow">{isKo ? "작업" : "Jobs"}</p>
        <h2>{isKo ? "인덱싱 큐 가시성" : "Indexing queue visibility"}</h2>
        <p>
          {isKo
            ? "워커 작업은 ingest와 삭제를 비동기로 처리해 대시보드 반응성을 유지하고, 버전 교체를 원자적으로 보장합니다."
            : "Worker jobs keep ingestion and deletion asynchronous so the dashboard stays responsive and version swaps remain atomic."}
        </p>
      </section>
      <JobsConsole locale={locale} />
    </div>
  );
}
