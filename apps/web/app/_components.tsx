import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const links = [
    { href: "/", label: "Overview" },
    { href: "/setup", label: "Setup" },
    { href: "/knowledge", label: "Knowledge" },
    { href: "/queries", label: "Queries" },
    { href: "/jobs", label: "Jobs" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <p className="eyebrow">Self-hosted support RAG</p>
        <h1>Mimir</h1>
        <p className="sidebar-copy">
          Postgres stays authoritative. Qdrant stays index-only. The worker owns
          every chunk and embedding lifecycle.
        </p>
        <nav className="nav">
          {links.map((link) => (
            <Link key={link.href} className="nav-link" href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

export function StatusBadge({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <span className={`status-badge ${ok ? "status-good" : "status-warn"}`}>
      <span className="status-dot" />
      {label}
    </span>
  );
}

export function SectionCard({
  title,
  body,
  href,
  meta,
}: {
  title: string;
  body: string;
  href?: string;
  meta?: string;
}) {
  const cardBody = (
    <>
      <div className="card-header">
        <h2>{title}</h2>
        {meta ? <span className="card-meta">{meta}</span> : null}
      </div>
      <p>{body}</p>
    </>
  );

  return href ? (
    <Link className="card" href={href}>
      {cardBody}
    </Link>
  ) : (
    <section className="card">{cardBody}</section>
  );
}

export function PageIntro({
  title,
  body,
  badge,
}: {
  title: string;
  body: string;
  badge?: ReactNode;
}) {
  return (
    <header className="page-intro">
      <div>
        <p className="eyebrow">Admin console</p>
        <h2>{title}</h2>
      </div>
      <p className="page-copy">{body}</p>
      {badge ? <div className="page-badge">{badge}</div> : null}
    </header>
  );
}
