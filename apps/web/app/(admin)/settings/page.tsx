import { SettingsConsole } from "../../components/settings-console";
import { getLocale } from "../../locale-server";

export default async function SettingsPage() {
  const locale = await getLocale();
  const isKo = locale === "ko";

  return (
    <div className="page">
      <section className="panel">
        <p className="eyebrow">{isKo ? "설정" : "Settings"}</p>
        <h2>{isKo ? "Provider, 모델, Discord 제어" : "Provider, model, and Discord controls"}</h2>
        <p>
          {isKo
            ? "답변 모델은 즉시 전환할 수 있지만, 임베딩 모델 변경은 재색인 계획이 필요합니다. Discord 설정은 지식 인덱싱과 분리해 봇을 얇게 유지합니다."
            : "Answer models can switch immediately, while embedding changes imply a reindex plan. Discord settings stay operationally separate from knowledge indexing so the bot can remain thin."}
        </p>
      </section>

      <SettingsConsole locale={locale} />
    </div>
  );
}
