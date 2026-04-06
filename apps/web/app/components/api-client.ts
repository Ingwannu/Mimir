"use client";

export interface KnowledgeBaseRecord {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description?: string | null;
  entryCount?: number;
}

export interface KnowledgeEntryRecord {
  id: string;
  workspaceId: string;
  knowledgeBaseId: string;
  title: string;
  type: "faq" | "article";
  status: string;
  category?: string | null;
  tags: string[];
  visibility: string;
  activeVersionId?: string | null;
  versionCount?: number;
}

export interface EntryVersionRecord {
  id: string;
  versionNumber: number;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  indexedAt?: string | null;
}

export interface KnowledgeEntryDetail extends KnowledgeEntryRecord {
  versions: EntryVersionRecord[];
}

export interface JobRecord {
  id: string;
  jobType: string;
  status: string;
  entryId?: string | null;
  versionId?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  attempts: number;
}

export interface QueryHitRecord {
  chunkId: string;
  score: number;
  content: string;
  entryId: string;
  versionId: string;
  knowledgeBaseId: string;
}

export interface QueryAnswerRecord {
  answer: string;
  citations: string[];
  confidence: number;
  needsHuman: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  answerModel?: string;
}

export interface QueryPreviewRecord {
  prompt: string;
  answer: QueryAnswerRecord;
  hits: QueryHitRecord[];
}

export interface ProviderSettingsRecord {
  provider: "openai";
  answerModel: string;
  fallbackModel: string | undefined;
  embeddingModel: string;
  storeResponses: boolean;
  chunkSize: number;
  chunkOverlap: number;
  maxContextChunks: number;
  secretRef: string | undefined;
  apiKey?: string | undefined;
  hasStoredSecret?: boolean | undefined;
}

export interface ModelsRecord {
  current: ProviderSettingsRecord;
  supported: {
    providers: string[];
    answerModels: string[];
    embeddingModels: string[];
  };
}

export interface DiscordSettingsRecord {
  clientId: string | undefined;
  guildId: string | undefined;
  mentionOnly: boolean;
  allowedChannelIds: string[];
  handoffMessage: string;
  botToken?: string | undefined;
  hasStoredBotToken?: boolean | undefined;
}

export interface AnalyticsRecord {
  period: "24h" | "7d" | "30d" | "all";
  queryCount: number;
  handoffCount: number;
  handoffRate: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  averageTotalTokensPerQuery: number;
}

export interface AnalyticsSeriesBucketRecord {
  label: string;
  queryCount: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AnalyticsSeriesRecord {
  period: "24h" | "7d" | "30d" | "all";
  buckets: AnalyticsSeriesBucketRecord[];
}

export interface DashboardSummaryRecord {
  knowledgeBaseCount: number;
  entryCount: number;
  queuedJobCount: number;
  queryCount: number;
  failedJobCount: number;
}

export interface QueryLogRecord {
  id: string;
  question: string;
  answer?: string | null;
  answerModel?: string | null;
  confidence?: number | null;
  needsHuman: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  createdAt: string;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/proxy${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Keep default message when the error body is not JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinTags(values: string[] | undefined): string {
  return values?.join(", ") ?? "";
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "n/a";
  }

  return new Date(value).toLocaleString();
}
