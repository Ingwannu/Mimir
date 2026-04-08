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
  const routeParams = await params;
  const kbSlug = decodeURIComponent(routeParams.kbSlug);
  const entrySlug = decodeURIComponent(routeParams.entrySlug);
  const [locale, docs, detail] = await Promise.all([
    getLocale(),
    getPublicDocsIndex(),
    getPublicDocDetail(kbSlug, entrySlug),
  ]);

  if (!docs || !detail) {
    notFound();
  }

  const isKo = locale === "ko";
  const blocks = parseDocBlocks(detail.content);

  return (
    <DocsShell
      current={{
        knowledgeBaseSlug: kbSlug,
        entrySlug: detail.entrySlug,
      }}
      index={docs}
      locale={locale}
      utility={
        <>
          <nav className="docs-page-toc">
            <div className="card-header">
              <h3>{isKo ? "이 페이지" : "On this page"}</h3>
              <span className="card-meta">
                {blocks.sections.length} {isKo ? "항목" : "sections"}
              </span>
            </div>
            <div className="docs-page-toc-links">
              {blocks.sections.map((section, index) => {
                const sectionId = `section-${index + 1}`;

                return (
                  <a
                    key={sectionId}
                    className="docs-page-toc-link"
                    href={`#${sectionId}`}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{section.question}</strong>
                  </a>
                );
              })}
            </div>
          </nav>
          <DocsAskPanel knowledgeBaseSlug={kbSlug} locale={locale} />
        </>
      }
    >
      <article className="docs-article">
        <div className="docs-breadcrumbs">
          <a href="/docs">{isKo ? "문서 홈" : "Docs home"}</a>
          <span>/</span>
          <a href={`/docs#${detail.knowledgeBaseSlug}`}>{detail.knowledgeBaseName}</a>
        </div>

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

        <div className="docs-article-summary">
          <div className="docs-summary-card">
            <strong>{blocks.sections.length}</strong>
            <span>{isKo ? "핵심 항목" : "Key sections"}</span>
          </div>
          {detail.tags.length ? (
            <div className="docs-summary-card">
              <strong>{detail.tags.length}</strong>
              <span>{isKo ? "태그" : "Tags"}</span>
            </div>
          ) : null}
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

        {blocks.source ? (
          <div className="docs-source-line">
            <span className="eyebrow">{isKo ? "출처" : "Source"}</span>
            <a href={blocks.source} rel="noreferrer" target="_blank">
              {blocks.source}
            </a>
          </div>
        ) : null}

        <div className="docs-faq-list">
          {blocks.sections.map((section, index) => (
            <section
              key={`${index}-${section.question.slice(0, 24)}`}
              className="docs-faq-card"
              id={`section-${index + 1}`}
            >
              <div className="docs-faq-question">
                <span className="pill">{String(index + 1).padStart(2, "0")}</span>
                <h2>{section.question}</h2>
              </div>
              <div className="docs-faq-answer">
                {section.answer.map((paragraph, paragraphIndex) => (
                  <p key={`${index}-${paragraphIndex}`}>{paragraph}</p>
                ))}
              </div>
            </section>
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

function parseDocBlocks(content: string): {
  source: string | null;
  sections: Array<{
    question: string;
    answer: string[];
  }>;
} {
  const rawBlocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  let source: string | null = null;
  const sections: Array<{ question: string; answer: string[] }> = [];

  for (const block of rawBlocks) {
    if (block.startsWith("출처:")) {
      source = block.replace(/^출처:\s*/, "").trim();
      continue;
    }

    const normalized = block.replace(/^\d+\.\s*/, "").trim();
    const [questionPart, ...answerParts] = normalized.split(/\n?답변:\s*/);
    const question = (questionPart ?? "").trim();
    const answerText = answerParts.join(" ").trim();

    if (!question) {
      continue;
    }

    sections.push({
      question,
      answer: answerText
        ? answerText
            .split(/\n+/)
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    });
  }

  if (sections.length > 0) {
    return { source, sections };
  }

  return {
    source,
    sections: rawBlocks.map((block) => ({
      question: block,
      answer: [],
    })),
  };
}
