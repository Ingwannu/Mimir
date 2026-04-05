import { KnowledgeAdmin } from "../components/knowledge-admin";
import { getLocale } from "../locale-server";

export default async function KnowledgePage() {
  const locale = await getLocale();
  const isKo = locale === "ko";
  return (
    <div className="page">
      <section className="panel">
        <p className="eyebrow">{isKo ? "지식" : "Knowledge"}</p>
        <h2>{isKo ? "원장 중심 지식 관리" : "Ledger-first knowledge management"}</h2>
        <p>
          {isKo
            ? "대시보드 수정은 모두 Postgres의 지식 엔티티와 불변 버전에 기록됩니다. chunking, embedding, 파생 벡터 저장은 오직 워커가 수행합니다."
            : "Dashboard edits stay in Postgres as knowledge entities and immutable versions. The worker remains the only actor that chunks, embeds, and writes derived vectors into Qdrant."}
        </p>
        <div className="tag-row">
          <span className="tag">{isKo ? "KB CRUD" : "KB CRUD"}</span>
          <span className="tag">{isKo ? "엔트리 버전" : "Entry versions"}</span>
          <span className="tag">{isKo ? "소프트 삭제" : "Soft delete"}</span>
          <span className="tag">{isKo ? "재색인 큐" : "Reindex queue"}</span>
        </div>
      </section>
      <KnowledgeAdmin locale={locale} />
    </div>
  );
}
