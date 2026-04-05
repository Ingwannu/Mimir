"use client";

import { useEffect, useState, useTransition } from "react";

import {
  apiFetch,
  type DiscordSettingsRecord,
  type ProviderSettingsRecord,
} from "./api-client";
import type { Locale } from "../locale";
import { RevealInput } from "./reveal-input";

export function SettingsConsole({ locale }: { locale: Locale }) {
  const isKo = locale === "ko";
  const [provider, setProvider] = useState<ProviderSettingsRecord | null>(null);
  const [discord, setDiscord] = useState<DiscordSettingsRecord | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const [nextProvider, nextDiscord] = await Promise.all([
        apiFetch<ProviderSettingsRecord>("/v1/admin/settings/provider"),
        apiFetch<DiscordSettingsRecord>("/v1/admin/settings/discord"),
      ]);

      setProvider(nextProvider);
      setDiscord(nextDiscord);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    }
  }

  if (!provider || !discord) {
    return <p className="notice">{isKo ? "설정을 불러오는 중..." : "Loading settings..."}</p>;
  }

  return (
    <div className="stack-page">
      {message ? <p className="notice notice-success">{message}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="dashboard-grid">
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setMessage("");
            startTransition(async () => {
              try {
                await apiFetch("/v1/admin/settings/provider", {
                  method: "PUT",
                  body: JSON.stringify({
                    ...provider,
                    fallbackModel: provider.fallbackModel || undefined,
                    secretRef: provider.secretRef || undefined,
                  }),
                });
                setMessage(
                  isKo ? "Provider 설정을 저장했습니다." : "Provider settings saved.",
                );
              } catch (nextError) {
                setError(getErrorMessage(nextError));
              }
            });
          }}
        >
          <div className="card-header">
            <h2>{isKo ? "Provider 설정" : "Provider"}</h2>
            <span className="card-meta">OpenAI</span>
          </div>
          <label className="field">
            <span>{isKo ? "답변 모델" : "Answer model"}</span>
            <input
              className="input"
              onChange={(event) =>
                setProvider((current) =>
                  current
                    ? {
                        ...current,
                        answerModel: event.target.value,
                      }
                    : current,
                )
              }
              value={provider.answerModel}
            />
          </label>
          <label className="field">
            <span>{isKo ? "폴백 모델" : "Fallback model"}</span>
            <input
              className="input"
              onChange={(event) =>
                setProvider((current) =>
                  current
                    ? {
                        ...current,
                        fallbackModel: event.target.value,
                      }
                    : current,
                )
              }
              value={provider.fallbackModel ?? ""}
            />
          </label>
          <label className="field">
            <span>{isKo ? "임베딩 모델" : "Embedding model"}</span>
            <input
              className="input"
              onChange={(event) =>
                setProvider((current) =>
                  current
                    ? {
                        ...current,
                        embeddingModel: event.target.value,
                      }
                    : current,
                )
              }
              value={provider.embeddingModel}
            />
          </label>
          <label className="field">
            <span>{isKo ? "Secret 참조 이름" : "Secret ref"}</span>
            <input
              className="input"
              onChange={(event) =>
                setProvider((current) =>
                  current
                    ? {
                        ...current,
                        secretRef: event.target.value,
                      }
                    : current,
                )
              }
              placeholder="openai-primary"
              value={provider.secretRef ?? ""}
            />
          </label>
          <label className="field">
            <span>{isKo ? "OpenAI API 키" : "OpenAI API key"}</span>
            <RevealInput
              onChange={(event) =>
                setProvider((current) =>
                  current
                    ? {
                        ...current,
                        apiKey: event.target.value || undefined,
                      }
                    : current,
                )
              }
              placeholder={
                provider.hasStoredSecret
                  ? isKo
                    ? "암호화 저장됨. 교체하려면 새 키를 입력하세요."
                    : "Stored securely. Enter a new key to rotate it."
                  : isKo
                    ? "API 키 입력"
                    : "Enter API key"
              }
              value={provider.apiKey ?? ""}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>{isKo ? "청크 크기" : "Chunk size"}</span>
              <input
                className="input"
                min={100}
                onChange={(event) =>
                  setProvider((current) =>
                    current
                      ? {
                          ...current,
                          chunkSize: Number(event.target.value),
                        }
                      : current,
                  )
                }
                type="number"
                value={provider.chunkSize}
              />
            </label>
            <label className="field">
              <span>{isKo ? "청크 오버랩" : "Chunk overlap"}</span>
              <input
                className="input"
                min={0}
                onChange={(event) =>
                  setProvider((current) =>
                    current
                      ? {
                          ...current,
                          chunkOverlap: Number(event.target.value),
                        }
                      : current,
                  )
                }
                type="number"
                value={provider.chunkOverlap}
              />
            </label>
            <label className="field">
              <span>{isKo ? "최대 컨텍스트 청크" : "Max context chunks"}</span>
              <input
                className="input"
                min={1}
                onChange={(event) =>
                  setProvider((current) =>
                    current
                      ? {
                          ...current,
                          maxContextChunks: Number(event.target.value),
                        }
                      : current,
                  )
                }
                type="number"
                value={provider.maxContextChunks}
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              checked={provider.storeResponses}
              onChange={(event) =>
                setProvider((current) =>
                  current
                    ? {
                        ...current,
                        storeResponses: event.target.checked,
                      }
                    : current,
                )
              }
              type="checkbox"
            />
            {isKo
              ? "Provider 레이어에 응답 저장"
              : "Store responses at the provider layer"}
          </label>
          <div className="button-row">
            <button className="button" disabled={isPending} type="submit">
              {isKo ? "Provider 설정 저장" : "Save provider settings"}
            </button>
          </div>
        </form>

        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setMessage("");
            startTransition(async () => {
              try {
                await apiFetch("/v1/admin/settings/discord", {
                  method: "PUT",
                  body: JSON.stringify({
                    ...discord,
                    clientId: discord.clientId || undefined,
                    guildId: discord.guildId || undefined,
                  }),
                });
                setMessage(
                  isKo ? "Discord 설정을 저장했습니다." : "Discord settings saved.",
                );
              } catch (nextError) {
                setError(getErrorMessage(nextError));
              }
            });
          }}
        >
          <div className="card-header">
            <h2>{isKo ? "Discord 설정" : "Discord delivery"}</h2>
            <span className="card-meta">{isKo ? "봇 연동" : "Bot-facing"}</span>
          </div>
          <label className="field">
            <span>{isKo ? "클라이언트 ID" : "Client ID"}</span>
            <input
              className="input"
              onChange={(event) =>
                setDiscord((current) =>
                  current
                    ? {
                        ...current,
                        clientId: event.target.value,
                      }
                    : current,
                )
              }
              value={discord.clientId ?? ""}
            />
          </label>
          <label className="field">
            <span>{isKo ? "Guild ID" : "Guild ID"}</span>
            <input
              className="input"
              onChange={(event) =>
                setDiscord((current) =>
                  current
                    ? {
                        ...current,
                        guildId: event.target.value,
                      }
                    : current,
                )
              }
              value={discord.guildId ?? ""}
            />
          </label>
          <label className="field">
            <span>{isKo ? "허용 채널 ID" : "Allowed channel IDs"}</span>
            <input
              className="input"
              onChange={(event) =>
                setDiscord((current) =>
                  current
                    ? {
                        ...current,
                        allowedChannelIds: event.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      }
                    : current,
                )
              }
              placeholder="123, 456"
              value={discord.allowedChannelIds.join(", ")}
            />
          </label>
          <label className="field">
            <span>{isKo ? "인계 메시지" : "Handoff message"}</span>
            <textarea
              className="textarea"
              onChange={(event) =>
                setDiscord((current) =>
                  current
                    ? {
                        ...current,
                        handoffMessage: event.target.value,
                      }
                    : current,
                )
              }
              rows={4}
              value={discord.handoffMessage}
            />
          </label>
          <label className="field">
            <span>{isKo ? "Discord 봇 토큰" : "Discord bot token"}</span>
            <RevealInput
              onChange={(event) =>
                setDiscord((current) =>
                  current
                    ? {
                        ...current,
                        botToken: event.target.value || undefined,
                      }
                    : current,
                )
              }
              placeholder={
                discord.hasStoredBotToken
                  ? isKo
                    ? "암호화 저장됨. 교체하려면 새 토큰을 입력하세요."
                    : "Stored securely. Enter a new token to rotate it."
                  : isKo
                    ? "봇 토큰 입력"
                    : "Enter bot token"
              }
              value={discord.botToken ?? ""}
            />
          </label>
          <label className="checkbox-row">
            <input
              checked={discord.mentionOnly}
              onChange={(event) =>
                setDiscord((current) =>
                  current
                    ? {
                        ...current,
                        mentionOnly: event.target.checked,
                      }
                    : current,
                )
              }
              type="checkbox"
            />
            {isKo ? "멘션 전용 모드" : "Mention-only mode"}
          </label>
          <div className="button-row">
            <button className="button" disabled={isPending} type="submit">
              {isKo ? "Discord 설정 저장" : "Save Discord settings"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
