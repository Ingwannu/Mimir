"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  apiFetch,
  type KnowledgeBaseRecord,
  type KnowledgeEntryDetail,
  type KnowledgeEntryRecord,
  joinTags,
  splitTags,
} from "./api-client";
import type { Locale } from "../locale";

const emptyKnowledgeBaseForm = {
  name: "",
  slug: "",
  description: "",
};

interface EntryEditorForm {
  type: "faq" | "article";
  title: string;
  content: string;
  category: string;
  tags: string;
  visibility: string;
  status: string;
}

const emptyEntryForm: EntryEditorForm = {
  type: "article" as EntryEditorForm["type"],
  title: "",
  content: "",
  category: "",
  tags: "",
  visibility: "guild",
  status: "published",
};

export function KnowledgeAdmin({ locale }: { locale: Locale }) {
  const isKo = locale === "ko";
  const [kbs, setKbs] = useState<KnowledgeBaseRecord[]>([]);
  const [entries, setEntries] = useState<KnowledgeEntryRecord[]>([]);
  const [selectedKbId, setSelectedKbId] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntryDetail | null>(
    null,
  );
  const [kbCreateForm, setKbCreateForm] = useState(emptyKnowledgeBaseForm);
  const [kbEditForm, setKbEditForm] = useState(emptyKnowledgeBaseForm);
  const [entryForm, setEntryForm] = useState<EntryEditorForm>(emptyEntryForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void refreshKnowledgeBases();
  }, []);

  useEffect(() => {
    if (!selectedKbId) {
      setEntries([]);
      return;
    }

    void refreshEntries(selectedKbId);
  }, [selectedKbId]);

  useEffect(() => {
    const selectedKb = kbs.find((kb) => kb.id === selectedKbId);

    if (!selectedKb) {
      setKbEditForm(emptyKnowledgeBaseForm);
      return;
    }

    setKbEditForm({
      name: selectedKb.name,
      slug: selectedKb.slug,
      description: selectedKb.description ?? "",
    });
  }, [kbs, selectedKbId]);

  useEffect(() => {
    if (!selectedEntryId) {
      setSelectedEntry(null);
      return;
    }

    void refreshEntryDetail(selectedEntryId);
  }, [selectedEntryId]);

  const selectedKb = useMemo(
    () => kbs.find((kb) => kb.id === selectedKbId) ?? null,
    [kbs, selectedKbId],
  );

  async function refreshKnowledgeBases() {
    try {
      const nextKbs = await apiFetch<KnowledgeBaseRecord[]>("/v1/admin/kbs");
      setKbs(nextKbs);

      if (!selectedKbId && nextKbs[0]) {
        setSelectedKbId(nextKbs[0].id);
      }

      if (selectedKbId && !nextKbs.some((kb) => kb.id === selectedKbId)) {
        setSelectedKbId(nextKbs[0]?.id ?? "");
        setSelectedEntryId("");
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    }
  }

  async function refreshEntries(knowledgeBaseId: string) {
    try {
      const nextEntries = await apiFetch<KnowledgeEntryRecord[]>(
        `/v1/admin/entries?knowledgeBaseId=${knowledgeBaseId}`,
      );
      setEntries(nextEntries);

      if (selectedEntryId && !nextEntries.some((entry) => entry.id === selectedEntryId)) {
        setSelectedEntryId("");
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    }
  }

  async function refreshEntryDetail(entryId: string) {
    try {
      const detail = await apiFetch<KnowledgeEntryDetail>(`/v1/admin/entries/${entryId}`);
      setSelectedEntry(detail);
      setEntryForm({
        type: detail.type as EntryEditorForm["type"],
        title: detail.title,
        content: detail.versions[0]?.content ?? "",
        category: detail.category ?? "",
        tags: joinTags(detail.tags),
        visibility: detail.visibility,
        status: detail.status,
      });
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    }
  }

  function resetFeedback() {
    setMessage("");
    setError("");
  }

  function buildEntryPayload() {
    return {
      knowledgeBaseId: selectedKbId,
      type: entryForm.type,
      title: entryForm.title,
      content: entryForm.content,
      category: entryForm.category || undefined,
      tags: splitTags(entryForm.tags),
      visibility: entryForm.visibility,
      status: entryForm.status,
    };
  }

  return (
    <div className="stack-page">
      <section className="dashboard-grid">
        <section className="stack">
          <div className="card-header">
            <h2>{isKo ? "지식 베이스" : "Knowledge bases"}</h2>
            <span className="card-meta">{kbs.length} {isKo ? "개" : "total"}</span>
          </div>

          <div className="stack compact">
            {kbs.map((kb) => (
              <button
                key={kb.id}
                className={`list-card ${kb.id === selectedKbId ? "is-active" : ""}`}
                onClick={() => {
                  resetFeedback();
                  setSelectedKbId(kb.id);
                }}
                type="button"
              >
                <strong>{kb.name}</strong>
                <span>
                  {kb.slug}
                  {typeof kb.entryCount === "number" ? ` - ${kb.entryCount} ${isKo ? "엔트리" : "entries"}` : ""}
                </span>
              </button>
            ))}
          </div>

          <form
            className="stack compact"
            onSubmit={(event) => {
              event.preventDefault();
              resetFeedback();
              startTransition(async () => {
                try {
                  const created = await apiFetch<KnowledgeBaseRecord>("/v1/admin/kbs", {
                    method: "POST",
                    body: JSON.stringify(kbCreateForm),
                  });
                  setKbCreateForm(emptyKnowledgeBaseForm);
                  setSelectedKbId(created.id);
                  setMessage(isKo ? "지식 베이스를 생성했습니다." : "Knowledge base created.");
                  await refreshKnowledgeBases();
                } catch (nextError) {
                  setError(getErrorMessage(nextError));
                }
              });
            }}
          >
            <label className="field">
              <span>{isKo ? "이름" : "Name"}</span>
              <input
                className="input"
                onChange={(event) =>
                  setKbCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Billing"
                value={kbCreateForm.name}
              />
            </label>
            <label className="field">
              <span>{isKo ? "슬러그" : "Slug"}</span>
              <input
                className="input"
                onChange={(event) =>
                  setKbCreateForm((current) => ({
                    ...current,
                    slug: event.target.value,
                  }))
                }
                placeholder="billing"
                value={kbCreateForm.slug}
              />
            </label>
            <label className="field">
              <span>{isKo ? "설명" : "Description"}</span>
              <textarea
                className="textarea"
                onChange={(event) =>
                  setKbCreateForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                value={kbCreateForm.description}
              />
            </label>
            <div className="button-row">
              <button className="button" disabled={isPending} type="submit">
                {isKo ? "KB 생성" : "Create KB"}
              </button>
            </div>
          </form>
        </section>

        <section className="stack">
          <div className="card-header">
            <h2>{isKo ? "선택된 지식 베이스" : "Selected knowledge base"}</h2>
            <span className="card-meta">
              {selectedKb ? `${entries.length} ${isKo ? "개 엔트리 로드됨" : "entries loaded"}` : isKo ? "KB를 선택하세요" : "Select a KB"}
            </span>
          </div>

          {selectedKb ? (
            <form
              className="stack compact"
              onSubmit={(event) => {
                event.preventDefault();
                resetFeedback();
                startTransition(async () => {
                  try {
                    await apiFetch(`/v1/admin/kbs/${selectedKb.id}`, {
                      method: "PATCH",
                      body: JSON.stringify(kbEditForm),
                    });
                    setMessage(isKo ? "지식 베이스를 수정했습니다." : "Knowledge base updated.");
                    await refreshKnowledgeBases();
                  } catch (nextError) {
                    setError(getErrorMessage(nextError));
                  }
                });
              }}
            >
              <label className="field">
                <span>{isKo ? "이름" : "Name"}</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setKbEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  value={kbEditForm.name}
                />
              </label>
              <label className="field">
                <span>{isKo ? "슬러그" : "Slug"}</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setKbEditForm((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                  value={kbEditForm.slug}
                />
              </label>
              <label className="field">
                <span>{isKo ? "설명" : "Description"}</span>
                <textarea
                  className="textarea"
                  onChange={(event) =>
                    setKbEditForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  value={kbEditForm.description}
                />
              </label>
              <div className="button-row">
                <button className="button" disabled={isPending} type="submit">
                  {isKo ? "KB 저장" : "Save KB"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={isPending}
                  onClick={() => {
                    if (!window.confirm(isKo ? "이 지식 베이스를 삭제할까요?" : "Delete this knowledge base?")) {
                      return;
                    }

                    resetFeedback();
                    startTransition(async () => {
                      try {
                        await apiFetch(`/v1/admin/kbs/${selectedKb.id}`, {
                          method: "DELETE",
                        });
                        setMessage(isKo ? "지식 베이스를 삭제했습니다." : "Knowledge base deleted.");
                        setSelectedKbId("");
                        setSelectedEntryId("");
                        await refreshKnowledgeBases();
                      } catch (nextError) {
                        setError(getErrorMessage(nextError));
                      }
                    });
                  }}
                  type="button"
                >
                  {isKo ? "KB 삭제" : "Delete KB"}
                </button>
              </div>
            </form>
          ) : (
            <p className="notice">{isKo ? "계속하려면 지식 베이스를 생성하거나 선택하세요." : "Create or select a knowledge base to continue."}</p>
          )}
        </section>
      </section>

      <section className="dashboard-grid">
        <section className="stack">
          <div className="card-header">
            <h2>{isKo ? "엔트리" : "Entries"}</h2>
            <span className="card-meta">{entries.length} {isKo ? "개 로드됨" : "loaded"}</span>
          </div>

          <div className="stack compact">
            {entries.map((entry) => (
              <button
                key={entry.id}
                className={`list-card ${entry.id === selectedEntryId ? "is-active" : ""}`}
                onClick={() => {
                  resetFeedback();
                  setSelectedEntryId(entry.id);
                }}
                type="button"
              >
                <strong>{entry.title}</strong>
                <span>
                  {entry.type} - {entry.status}
                  {typeof entry.versionCount === "number"
                    ? ` - ${entry.versionCount} ${isKo ? "버전" : "versions"}`
                    : ""}
                </span>
              </button>
            ))}
          </div>

          <form
            className="stack compact"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedKbId) {
                setError(isKo ? "먼저 지식 베이스를 생성하세요." : "Create a knowledge base first.");
                return;
              }

              resetFeedback();
              startTransition(async () => {
                try {
                  const created = await apiFetch<{ entryId: string }>("/v1/admin/entries", {
                    method: "POST",
                    body: JSON.stringify(buildEntryPayload()),
                  });
                  setSelectedEntryId(created.entryId);
                  setMessage(isKo ? "엔트리를 생성했고 인덱싱 큐에 넣었습니다." : "Entry created and queued for indexing.");
                  await refreshEntries(selectedKbId);
                } catch (nextError) {
                  setError(getErrorMessage(nextError));
                }
              });
            }}
          >
            <div className="card-header">
              <h2>{isKo ? "엔트리 생성" : "Create entry"}</h2>
              <span className="card-meta">{isKo ? "새 원본 레코드 생성" : "Posts a new source record"}</span>
            </div>
            <label className="field">
              <span>{isKo ? "유형" : "Type"}</span>
              <select
                className="select"
                onChange={(event) =>
                    setEntryForm((current) => ({
                      ...current,
                      type: event.target.value as EntryEditorForm["type"],
                    }))
                }
                value={entryForm.type}
              >
                <option value="article">{isKo ? "문서" : "Article"}</option>
                <option value="faq">FAQ</option>
              </select>
            </label>
            <label className="field">
              <span>{isKo ? "제목" : "Title"}</span>
              <input
                className="input"
                onChange={(event) =>
                  setEntryForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                value={entryForm.title}
              />
            </label>
            <label className="field">
              <span>{isKo ? "내용" : "Content"}</span>
              <textarea
                className="textarea tall"
                onChange={(event) =>
                  setEntryForm((current) => ({
                    ...current,
                    content: event.target.value,
                  }))
                }
                rows={10}
                value={entryForm.content}
              />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>{isKo ? "카테고리" : "Category"}</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setEntryForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  value={entryForm.category}
                />
              </label>
              <label className="field">
                <span>{isKo ? "태그" : "Tags"}</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setEntryForm((current) => ({
                      ...current,
                      tags: event.target.value,
                    }))
                  }
                  placeholder="refund, billing"
                  value={entryForm.tags}
                />
              </label>
              <label className="field">
                <span>{isKo ? "공개 범위" : "Visibility"}</span>
                <select
                  className="select"
                  onChange={(event) =>
                    setEntryForm((current) => ({
                      ...current,
                      visibility: event.target.value,
                    }))
                  }
                  value={entryForm.visibility}
                >
                  <option value="internal">{isKo ? "내부" : "Internal"}</option>
                  <option value="guild">{isKo ? "길드" : "Guild"}</option>
                  <option value="public">{isKo ? "공개" : "Public"}</option>
                </select>
              </label>
              <label className="field">
                <span>{isKo ? "상태" : "Status"}</span>
                <select
                  className="select"
                  onChange={(event) =>
                    setEntryForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  value={entryForm.status}
                >
                  <option value="published">{isKo ? "게시됨" : "Published"}</option>
                  <option value="draft">{isKo ? "초안" : "Draft"}</option>
                  <option value="archived">{isKo ? "보관됨" : "Archived"}</option>
                </select>
              </label>
            </div>
            <div className="button-row">
              <button className="button" disabled={isPending} type="submit">
                {isKo ? "엔트리 생성" : "Create entry"}
              </button>
            </div>
          </form>
        </section>

        <section className="stack">
          <div className="card-header">
            <h2>{isKo ? "선택된 엔트리" : "Selected entry"}</h2>
            <span className="card-meta">
              {selectedEntry ? `${selectedEntry.versions.length} ${isKo ? "개 버전" : "versions"}` : isKo ? "엔트리를 선택하세요" : "Pick an entry"}
            </span>
          </div>

          {selectedEntry ? (
            <>
              <div className="button-row">
                <button
                  className="button"
                  disabled={isPending}
                  onClick={() => {
                    resetFeedback();
                    startTransition(async () => {
                      try {
                        await apiFetch(`/v1/admin/entries/${selectedEntry.id}`, {
                          method: "PATCH",
                          body: JSON.stringify(buildEntryPayload()),
                        });
                        setMessage(isKo ? "엔트리를 새 버전으로 저장했습니다." : "Entry updated as a new version.");
                        await refreshEntries(selectedKbId);
                        await refreshEntryDetail(selectedEntry.id);
                      } catch (nextError) {
                        setError(getErrorMessage(nextError));
                      }
                    });
                  }}
                  type="button"
                >
                  {isKo ? "버전 저장" : "Save version"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={isPending}
                  onClick={() => {
                    resetFeedback();
                    startTransition(async () => {
                      try {
                        await apiFetch(`/v1/admin/entries/${selectedEntry.id}/reindex`, {
                          method: "POST",
                          body: JSON.stringify({}),
                        });
                        setMessage(isKo ? "재색인 작업을 큐에 넣었습니다." : "Reindex job queued.");
                      } catch (nextError) {
                        setError(getErrorMessage(nextError));
                      }
                    });
                  }}
                  type="button"
                >
                  {isKo ? "재색인" : "Reindex"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={isPending}
                  onClick={() => {
                    if (!window.confirm(isKo ? "이 엔트리를 삭제할까요?" : "Delete this entry?")) {
                      return;
                    }

                    resetFeedback();
                    startTransition(async () => {
                      try {
                        await apiFetch(`/v1/admin/entries/${selectedEntry.id}`, {
                          method: "DELETE",
                        });
                        setMessage(isKo ? "엔트리를 보관 처리하고 삭제 작업을 큐에 넣었습니다." : "Entry archived and delete job queued.");
                        setSelectedEntryId("");
                        await refreshEntries(selectedKbId);
                      } catch (nextError) {
                        setError(getErrorMessage(nextError));
                      }
                    });
                  }}
                  type="button"
                >
                  {isKo ? "삭제" : "Delete"}
                </button>
              </div>

              <div className="stack compact">
                {selectedEntry.versions.map((version) => (
                  <div key={version.id} className="list-card static">
                    <strong>v{version.versionNumber}</strong>
                    <span>
                      {version.status}
                      {version.indexedAt
                        ? ` - indexed ${new Date(version.indexedAt).toLocaleString()}`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="notice">
              {isKo
                ? "엔트리를 선택하면 다음 버전을 편집하고, 재색인 작업을 넣거나 버전 이력을 확인할 수 있습니다."
                : "Select an entry to edit its next version, queue reindex work, or inspect version history."}
            </p>
          )}

          {message ? <p className="notice notice-success">{message}</p> : null}
          {error ? <p className="notice notice-error">{error}</p> : null}
        </section>
      </section>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
