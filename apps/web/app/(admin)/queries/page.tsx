import { QueryLab } from "../../components/query-lab";
import { getLocale } from "../../locale-server";

export default async function QueriesPage() {
  const locale = await getLocale();
  const isKo = locale === "ko";

  return (
    <div className="page">
      <section className="panel">
        <p className="eyebrow">{isKo ? "질의 검사기" : "Query inspector"}</p>
        <h2>{isKo ? "프롬프트와 검색 결과 가시성" : "Prompt and retrieval visibility"}</h2>
        <p>
          {isKo
            ? "Discord로 나가기 전에 retrieval을 테스트하세요. 조합된 프롬프트, 검색된 chunk, 구조화된 답변, 신뢰도를 한 화면에서 확인할 수 있습니다."
            : "Test retrieval before it reaches Discord. Preview the assembled prompt, returned chunks, structured answer, and confidence score in one place."}
        </p>
      </section>

      <QueryLab locale={locale} />
    </div>
  );
}
