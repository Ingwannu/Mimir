import { notFound } from "next/navigation";

import { getPublicDocDetail, getPublicDocsIndex } from "../../../lib";
import { getLocale } from "../../../locale-server";
import { DocsAskPanel } from "../../components/docs-ask-panel";
import { DocsShell } from "../../components/docs-shell";

export const dynamic = "force-dynamic";

interface DocPageProps {
  params: Promise<{
    kbSlug: string;
    entrySlug: string;
  }>;
}

export default async function PublicDocPage({ params }: DocPageProps) {
  const { kbSlug, entrySlug } = await params;
  const [locale, docs, detail] = await Promise.all([
    getLocale(),
    getPublicDocsIndex(),
    getPublicDocDetail(kbSlug, entrySlug),
  ]);

  if (!docs || !detail) {
    notFound();
  }

  const isKo = locale === "ko";

  return (
    <DocsShell
      current={{
        knowledgeBaseSlug: kbSlug,
        entrySlug: detail.entrySlug,
      }}
      index={docs}
      locale={locale}
      utility={<DocsAskPanel knowledgeBaseSlug={kbSlug} locale={locale} />}
    >
      <article className="docs-article">
        <div className="docs-article-header">
          <p className="eyebrow">{detail.knowledgeBaseName}</p>
          <h1>{detail.title}</h1>
          <p className="docs-meta-line">
            {detail.category ?? (isKo ? "문서" : "Doc")} •{" "}
            {new Date(detail.updatedAt).toLocaleDateString(
              isKo ? "ko-KR" : "en-US",
            )}
          </p>
        </div>

        {detail.tags.length ? (
          <div className="pill-row">
            {detail.tags.map((tag) => (
              <span key={tag} className="pill">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="docs-body">
          {detail.content.split(/\n{2,}/).map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
          ))}
        </div>

        {detail.relatedEntries.length ? (
          <section className="stack">
            <div className="card-header">
              <h2>{isKo ? "관련 문서" : "Related docs"}</h2>
            </div>
            <div className="docs-home-links">
              {detail.relatedEntries.slice(0, 6).map((entry) => (
                <a
                  key={entry.entryId}
                  className="docs-related-link"
                  href={`/docs/${entry.knowledgeBaseSlug}/${entry.entrySlug}`}
                >
                  {entry.title}
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </DocsShell>
  );
}
