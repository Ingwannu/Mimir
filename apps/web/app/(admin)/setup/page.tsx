import Link from "next/link";
import { getLocale } from "../../locale-server";

export default function SetupPage() {
  const localePromise = getLocale();
  return <SetupPageInner localePromise={localePromise} />;
}

async function SetupPageInner({
  localePromise,
}: {
  localePromise: ReturnType<typeof getLocale>;
}) {
  const locale = await localePromise;
  const isKo = locale === "ko";

  const quickSteps = isKo
    ? [
        "1. `설정`에서 OpenAI API 키와 기본 모델을 저장합니다.",
        "2. `지식`에서 첫 KB를 만들고 문서나 FAQ를 추가합니다.",
        "3. `작업`에서 색인이 완료될 때까지 기다립니다.",
        "4. `질의`에서 질문을 넣고 답변과 source를 확인합니다.",
        "5. 준비가 끝나면 Discord 설정을 저장하고 봇을 연결합니다.",
      ]
    : [
        "1. Save your OpenAI API key and default models in Settings.",
        "2. Create your first KB and add a document or FAQ in Knowledge.",
        "3. Wait for indexing to finish in Jobs.",
        "4. Test a question in Queries and inspect the returned sources.",
        "5. Save Discord settings and connect the bot when ready.",
      ];

  return (
    <div className="page">
      <section className="panel">
        <p className="eyebrow">{isKo ? "설정 마법사" : "Setup wizard"}</p>
        <h2>{isKo ? "첫 실행 설정" : "First-run bootstrap"}</h2>
        <p>
          {isKo
            ? "처음에는 복잡하게 생각하지 마세요. `설정 -> 지식 추가 -> 작업 완료 확인 -> 질의 테스트 -> Discord 연결` 순서로 진행하면 가장 쉽게 시작할 수 있습니다."
            : "Keep the first run simple: `Settings -> Knowledge -> Jobs -> Queries -> Discord` is the easiest path to a working setup."}
        </p>
      </section>

      <section className="stack">
        <h2>{isKo ? "한눈에 보는 시작 순서" : "Quick start order"}</h2>
        <ul>
          {quickSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="dashboard-grid">
        <section className="stack">
          <h2>{isKo ? "바로 가기" : "Quick actions"}</h2>
          <div className="button-row">
            <Link className="button" href="/settings">
              {isKo ? "설정 열기" : "Open settings"}
            </Link>
            <Link className="button button-secondary" href="/knowledge">
              {isKo ? "지식 추가" : "Add knowledge"}
            </Link>
            <Link className="button button-secondary" href="/queries">
              {isKo ? "미리보기 실행" : "Run preview"}
            </Link>
          </div>
        </section>
      </section>
    </div>
  );
}
