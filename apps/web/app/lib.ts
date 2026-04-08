import { getAdminProxyHeaders } from "./auth";

const apiBaseUrl = process.env.WEB_API_BASE_URL ?? "http://localhost:4000";

export interface ApiHealthSnapshot {
  ok: boolean;
  services: Record<string, { ok: boolean; detail?: string }>;
}

export interface DashboardSummary {
  knowledgeBaseCount: number;
  entryCount: number;
  queuedJobCount: number;
  queryCount: number;
  failedJobCount: number;
}

export interface KnowledgeBaseSummary {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  deletedAt?: string | null;
}

export interface KnowledgeEntrySummary {
  id: string;
  workspaceId: string;
  knowledgeBaseId: string;
  type: "faq" | "article";
  title: string;
  status: "draft" | "published" | "archived";
  activeVersionId: string | null;
  category: string | null;
  tags: string[];
  visibility: "internal" | "guild" | "public";
  deletedAt?: string | null;
  versionCount?: number;
  latestVersionStatus?: "queued" | "processing" | "ready" | "failed" | null;
  updatedAt: string;
}

export interface EntryVersionRecord {
  id: string;
  versionNumber: number;
  title: string;
  content: string;
  status: "queued" | "processing" | "ready" | "failed";
  createdAt: string;
  indexedAt: string | null;
}

export interface KnowledgeEntryDetail extends KnowledgeEntrySummary {
  versions: EntryVersionRecord[];
}

export interface IndexJobRecord {
  id: string;
  knowledgeBaseId: string | null;
  entryId: string | null;
  versionId: string | null;
  jobType: string;
  status: string;
  attempts: number;
  error: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface QueryLogRecord {
  id: string;
  question: string;
  answer: string | null;
  answerModel?: string | null;
  confidence: number | null;
  needsHuman: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  createdAt: string;
}

export interface AnalyticsSnapshot {
  period: "24h" | "7d" | "30d" | "all";
  queryCount: number;
  handoffCount: number;
  handoffRate: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  averageTotalTokensPerQuery: number;
}

export interface ProviderSettings {
  provider: "openai";
  answerModel: string;
  fallbackModel?: string;
  embeddingModel: string;
  storeResponses: boolean;
  chunkSize: number;
  chunkOverlap: number;
  maxContextChunks: number;
  secretRef?: string;
}

export interface DiscordSettings {
  clientId?: string;
  guildId?: string;
  mentionOnly: boolean;
  allowedChannelIds: string[];
  handoffMessage: string;
}

export interface QueryPreviewPayload {
  prompt: string;
  answer: {
    answer: string;
    citations: string[];
    confidence: number;
    needsHuman: boolean;
  };
  hits: Array<{
    chunkId: string;
    knowledgeBaseId: string;
    entryId: string;
    versionId: string;
    score: number;
    content: string;
    payload: Record<string, unknown>;
  }>;
}

export interface SourceLookupItem {
  chunkId: string;
  entryId: string;
  versionId: string;
  knowledgeBaseId: string;
  title: string;
  content: string;
  ordinal: number;
}

export interface PublicDocLink {
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  knowledgeBaseSlug: string;
  entryId: string;
  entrySlug: string;
  title: string;
  category: string | null;
  summary: string;
  updatedAt: string;
}

export interface PublicDocsGroup {
  knowledgeBaseId: string;
  name: string;
  slug: string;
  description: string | null;
  entries: PublicDocLink[];
}

export interface PublicDocsIndex {
  knowledgeBases: PublicDocsGroup[];
}

export interface PublicDocDetail {
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  knowledgeBaseSlug: string;
  entryId: string;
  entrySlug: string;
  title: string;
  category: string | null;
  tags: string[];
  updatedAt: string;
  content: string;
  relatedEntries: PublicDocLink[];
}

export interface PublicSearchResult {
  question: string;
  results: Array<
    PublicDocLink & {
      chunkId: string;
      score: number;
      excerpt: string;
    }
  >;
}

export interface PublicAskResponse {
  answer: string;
  citations: string[];
  confidence: number;
  needsHuman: boolean;
  sources: Array<
    PublicDocLink & {
      chunkId: string;
      score: number;
      excerpt: string;
    }
  >;
}

export async function getApiHealth(): Promise<ApiHealthSnapshot | null> {
  return safeFetchJson<ApiHealthSnapshot>("/v1/health");
}

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  return safeFetchJson<DashboardSummary>("/v1/admin/dashboard");
}

export async function getKnowledgeBases(): Promise<KnowledgeBaseSummary[]> {
  return fetchJson<KnowledgeBaseSummary[]>("/v1/admin/kbs");
}

export async function getKnowledgeBase(
  knowledgeBaseId: string,
): Promise<KnowledgeBaseSummary | null> {
  return safeFetchJson<KnowledgeBaseSummary>(`/v1/admin/kbs/${knowledgeBaseId}`);
}

export async function getEntries(
  knowledgeBaseId?: string,
): Promise<KnowledgeEntrySummary[]> {
  const query = knowledgeBaseId
    ? `?knowledgeBaseId=${encodeURIComponent(knowledgeBaseId)}`
    : "";
  return fetchJson<KnowledgeEntrySummary[]>(`/v1/admin/entries${query}`);
}

export async function getEntry(
  entryId: string,
): Promise<KnowledgeEntryDetail | null> {
  return safeFetchJson<KnowledgeEntryDetail>(`/v1/admin/entries/${entryId}`);
}

export async function getJobs(): Promise<IndexJobRecord[]> {
  return fetchJson<IndexJobRecord[]>("/v1/admin/jobs");
}

export async function getQueryLogs(): Promise<QueryLogRecord[]> {
  return fetchJson<QueryLogRecord[]>("/v1/admin/logs");
}

export async function getAnalytics(
  period: AnalyticsSnapshot["period"] = "all",
): Promise<AnalyticsSnapshot | null> {
  return safeFetchJson<AnalyticsSnapshot>(
    `/v1/admin/analytics?period=${encodeURIComponent(period)}`,
  );
}

export async function getProviderSettings(): Promise<ProviderSettings> {
  return fetchJson<ProviderSettings>("/v1/admin/settings/provider");
}

export async function getDiscordSettings(): Promise<DiscordSettings> {
  return fetchJson<DiscordSettings>("/v1/admin/settings/discord");
}

export async function runQueryPreview(input: {
  question: string;
  knowledgeBaseIds: string[];
}): Promise<QueryPreviewPayload | null> {
  if (!input.question.trim()) {
    return null;
  }

  return fetchJson<QueryPreviewPayload>("/v1/query/preview", {
    method: "POST",
    body: {
      workspaceId: process.env.WORKSPACE_ID ?? "workspace_demo",
      question: input.question.trim(),
      knowledgeBaseIds: input.knowledgeBaseIds,
    },
  });
}

export async function lookupSources(
  citationIds: string[],
): Promise<SourceLookupItem[]> {
  if (citationIds.length === 0) {
    return [];
  }

  return fetchJson<SourceLookupItem[]>("/v1/query/sources", {
    method: "POST",
    body: {
      workspaceId: process.env.WORKSPACE_ID ?? "workspace_demo",
      citationIds,
    },
  });
}

export async function getPublicDocsIndex(): Promise<PublicDocsIndex | null> {
  return safeFetchJson<PublicDocsIndex>("/v1/public/docs");
}

export async function getPublicDocDetail(
  knowledgeBaseSlug: string,
  entrySlug: string,
): Promise<PublicDocDetail | null> {
  return safeFetchJson<PublicDocDetail>(
    `/v1/public/docs/${encodeURIComponent(knowledgeBaseSlug)}/${encodeURIComponent(entrySlug)}`,
  );
}

export async function searchPublicDocs(input: {
  question: string;
  knowledgeBaseSlugs?: string[];
}): Promise<PublicSearchResult | null> {
  if (!input.question.trim()) {
    return null;
  }

  return fetchJson<PublicSearchResult>("/v1/public/search", {
    method: "POST",
    body: {
      question: input.question.trim(),
      knowledgeBaseSlugs: input.knowledgeBaseSlugs ?? [],
    },
  });
}

export async function askPublicDocs(input: {
  question: string;
  knowledgeBaseSlugs?: string[];
}): Promise<PublicAskResponse | null> {
  if (!input.question.trim()) {
    return null;
  }

  return fetchJson<PublicAskResponse>("/v1/public/ask", {
    method: "POST",
    body: {
      question: input.question.trim(),
      knowledgeBaseSlugs: input.knowledgeBaseSlugs ?? [],
    },
  });
}

export async function fetchJson<T>(
  path: string,
  init?: {
    method?: string;
    body?: Record<string, unknown>;
  },
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: await buildHeaders(),
    cache: "no-store",
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function safeFetchJson<T>(path: string): Promise<T | null> {
  try {
    return await fetchJson<T>(path);
  } catch {
    return null;
  }
}

export async function buildHeaders(): Promise<Headers> {
  const headers = await getAdminProxyHeaders();
  headers.set("content-type", "application/json");

  return headers;
}

export function parseTagInput(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parseChannelInput(value: string): string[] {
  return value
    .split(",")
    .map((channelId) => channelId.trim())
    .filter(Boolean);
}

export function toTagInput(tags: string[]): string {
  return tags.join(", ");
}

export function toChannelInput(channels: string[]): string {
  return channels.join(", ");
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}
