import { bootstrapAction, loginAction } from "../actions";
import { needsBootstrap } from "../auth";
import { RevealInput } from "../components/reveal-input";
import { getLocale } from "../locale-server";

interface LoginPageProps {
  searchParams?: Promise<{
    next?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = params.next ?? "/";
  const error = params.error;
  const bootstrap = await needsBootstrap();
  const locale = await getLocale();
  const isKo = locale === "ko";

  return (
    <div className="login-shell">
      <section className="login-card">
        <p className="eyebrow">{isKo ? "운영자 접근" : "Operator access"}</p>
        <h1>
          {bootstrap
            ? isKo
              ? "첫 관리자 계정 만들기"
              : "Create the first admin"
            : isKo
              ? "관리 콘솔 로그인"
              : "Sign in to the admin console"}
        </h1>
        <p className="login-copy">
          {bootstrap
            ? isKo
              ? "첫 관리자 계정을 생성하세요. 이후부터는 이메일과 비밀번호로 로그인합니다."
              : "Bootstrap the first administrator account. After that, standard email and password login will be required."
            : isKo
              ? "관리자 이메일과 비밀번호로 로그인하세요. 브라우저에는 HttpOnly 세션 토큰만 저장됩니다."
              : "Use the administrator email and password for the dashboard. The browser stores only a secure session token in an HttpOnly cookie."}
        </p>

        <form action={bootstrap ? bootstrapAction : loginAction} className="stack">
          <input name="next" type="hidden" value={nextPath} />
          {bootstrap ? (
            <label className="field">
              <span>{isKo ? "이름" : "Name"}</span>
              <input
                className="input"
                name="name"
                placeholder={isKo ? "관리자 이름" : "Admin name"}
                type="text"
              />
            </label>
          ) : null}
          <label className="field">
            <span>{isKo ? "이메일" : "Email"}</span>
            <input
              autoComplete="username"
              className="input"
              name="email"
              placeholder={isKo ? "admin@example.com" : "admin@example.com"}
              type="email"
            />
          </label>
          <label className="field">
            <span>{isKo ? "비밀번호" : "Password"}</span>
            <RevealInput
              autoComplete={bootstrap ? "new-password" : "current-password"}
              name="password"
              placeholder={isKo ? "비밀번호 입력" : "Enter password"}
            />
          </label>
          {error ? (
            <p className="notice notice-error">
              {error === "bootstrap"
                ? isKo
                  ? "초기 관리자 생성에 실패했습니다. API 로그를 확인한 뒤 다시 시도하세요."
                  : "Bootstrap failed. Check the API logs and try again."
                : isKo
                  ? "로그인 정보가 올바르지 않습니다. 다시 시도하세요."
                  : "Invalid credentials. Try again."}
            </p>
          ) : null}
          <div className="button-row">
            <button className="button" type="submit">
              {bootstrap
                ? isKo
                  ? "관리자 생성"
                  : "Create admin"
                : isKo
                  ? "계속"
                  : "Continue"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
