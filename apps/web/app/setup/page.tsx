import Link from "next/link";
import { getLocale } from "../locale-server";

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

  const detailedSteps = isKo
    ? [
        {
          title: "1. 먼저 설정 화면부터 여세요",
          body: "상단 메뉴의 `설정`으로 이동해서 OpenAI API 키, 답변 모델, 임베딩 모델, Discord 기본값을 입력하세요. OpenAI 키가 없으면 실제 모델 호출 대신 mock-safe 경로로만 동작합니다.",
        },
        {
          title: "2. 무엇을 입력해야 하나요?",
          body: "`답변 모델`은 사용자가 받는 최종 응답용입니다. `임베딩 모델`은 검색용 벡터를 만드는 데 쓰입니다. `OpenAI API 키`와 `Discord 봇 토큰` 입력칸은 오른쪽 눈 버튼으로 보이기/숨기기가 가능합니다.",
        },
        {
          title: "3. 지식 베이스를 만드세요",
          body: "`지식` 화면에서 KB를 먼저 만들고, 그 안에 엔트리를 추가하세요. 예를 들어 `청구`, `정책`, `호스팅` 같은 KB를 만들고, 그 안에 환불 규정이나 서버 이전 안내 같은 문서를 넣으면 됩니다.",
        },
        {
          title: "4. 저장했다고 바로 검색되지는 않습니다",
          body: "엔트리를 저장하면 워커가 chunking, embedding, 색인을 처리합니다. 그래서 바로 `질의`로 가지 말고 `작업` 화면에서 상태가 `완료`가 될 때까지 먼저 확인하세요.",
        },
        {
          title: "5. 질의 화면에서 꼭 검증하세요",
          body: "`질의` 화면에서는 답변만 보는 게 아니라, 어떤 chunk가 검색됐는지, confidence가 얼마인지, citations가 붙었는지를 같이 봐야 합니다. 여기서 이상하면 지식 본문이나 태그를 수정하면 됩니다.",
        },
        {
          title: "6. Discord 연결은 마지막에 하세요",
          body: "지식과 질의 검증이 끝난 뒤 `설정`에서 Discord Client ID, Guild ID, Bot Token을 저장하세요. 그 다음 `/ask`, `/sources`, `/kb list` 같은 명령을 실제 서버에서 테스트하면 됩니다.",
        },
      ]
    : [
        {
          title: "1. Start in Settings",
          body: "Open `Settings` from the top navigation and save your OpenAI API key, answer model, embedding model, and Discord defaults. Without an OpenAI key, the app will stay in mock-safe mode.",
        },
        {
          title: "2. Know what each field does",
          body: "`Answer model` controls the final reply users receive. `Embedding model` controls retrieval vectors. Sensitive inputs like the OpenAI key and Discord bot token can be shown or hidden with the eye button.",
        },
        {
          title: "3. Create a knowledge base",
          body: "Go to `Knowledge`, create a KB first, then add entries inside it. Typical KBs are `billing`, `policy`, or `hosting`, and entries can be refund policies, setup guides, or FAQ answers.",
        },
        {
          title: "4. Saving is not the same as indexing",
          body: "When you save an entry, the worker still needs to chunk, embed, and index it. Check `Jobs` and wait until the status becomes `done` before testing retrieval.",
        },
        {
          title: "5. Use Queries to validate quality",
          body: "In `Queries`, inspect the answer, retrieved chunks, confidence, and citations together. If the answer looks off, adjust the source text, tags, or KB selection and reindex.",
        },
        {
          title: "6. Connect Discord last",
          body: "After knowledge and retrieval look correct, save the Discord Client ID, Guild ID, and Bot Token in `Settings`. Then test `/ask`, `/sources`, and `/kb list` on your actual server.",
        },
      ];

  const commonMistakes = isKo
    ? [
        "엔트리를 저장한 직후 검색이 안 되면, 대부분 `작업` 화면에서 아직 완료되지 않은 경우입니다.",
        "Discord 연결 전에도 웹 콘솔과 질의 테스트는 먼저 할 수 있습니다.",
        "임베딩 모델을 바꾸면 검색 품질이 달라질 수 있으니, 보통은 변경 후 재색인을 같이 계획해야 합니다.",
      ]
    : [
        "If search does not work right after saving an entry, the worker usually has not finished indexing yet.",
        "You can validate the web console and retrieval before connecting Discord.",
        "Changing the embedding model usually requires a reindex plan because retrieval quality can change.",
      ];

  return (
    <div className="page">
      <section className="panel">
        <p className="eyebrow">{isKo ? "설정 마법사" : "Setup wizard"}</p>
        <h2>{isKo ? "첫 실행 설정" : "First-run bootstrap"}</h2>
        <p>
          {isKo
            ? "처음에는 복잡하게 생각하지 마세요. 이 프로젝트는 `설정 -> 지식 추가 -> 작업 완료 확인 -> 질의 테스트 -> Discord 연결` 순서로 진행하면 가장 쉽게 세팅할 수 있습니다."
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
          <h2>{isKo ? "자세한 설명" : "Detailed guide"}</h2>
          <div className="setup-steps">
            {detailedSteps.map((step) => (
              <article key={step.title} className="step-card">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="stack">
          <h2>{isKo ? "다음 단계" : "Next actions"}</h2>
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
          <div className="step-card">
            <h3>{isKo ? "처음에 자주 막히는 이유" : "Common first-run issues"}</h3>
            <ul>
              {commonMistakes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      </section>
    </div>
  );
}
