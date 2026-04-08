import { z } from "zod";

export const entryTypeSchema = z.enum(["faq", "article"]);
export const entryStatusSchema = z.enum(["draft", "published", "archived"]);
export const entryVersionStatusSchema = z.enum([
  "queued",
  "processing",
  "ready",
  "failed",
]);
export const visibilitySchema = z.enum(["internal", "guild", "public"]);
export const indexJobTypeSchema = z.enum([
  "ingest_text",
  "ingest_file",
  "reindex_item",
  "reindex_kb",
  "delete_item_vectors",
  "full_reembed",
]);
export const indexJobStatusSchema = z.enum([
  "queued",
  "processing",
  "failed",
  "done",
]);

export const queryRequestSchema = z.object({
  workspaceId: z.string().min(1),
  question: z.string().min(1),
  knowledgeBaseIds: z.array(z.string().min(1)).default([]),
  guildId: z.string().optional(),
  channelId: z.string().optional(),
  userId: z.string().optional(),
});

export const structuredAnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  needsHuman: z.boolean(),
});

export const tokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export const searchHitSchema = z.object({
  chunkId: z.string().min(1),
  workspaceId: z.string().min(1),
  knowledgeBaseId: z.string().min(1),
  entryId: z.string().min(1),
  versionId: z.string().min(1),
  score: z.number(),
  content: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const queryResponseSchema = structuredAnswerSchema.extend({
  hits: z.array(searchHitSchema),
  usage: tokenUsageSchema.optional(),
  answerModel: z.string().optional(),
});

export const queryPreviewResponseSchema = z.object({
  prompt: z.string(),
  answer: structuredAnswerSchema.extend({
    usage: tokenUsageSchema.optional(),
    answerModel: z.string().optional(),
  }),
  hits: z.array(searchHitSchema),
});

export const sourceLookupRequestSchema = z.object({
  workspaceId: z.string().min(1),
  citationIds: z.array(z.string().min(1)).min(1),
});

export const sourceLookupItemSchema = z.object({
  chunkId: z.string().min(1),
  entryId: z.string().min(1),
  versionId: z.string().min(1),
  knowledgeBaseId: z.string().min(1),
  title: z.string(),
  content: z.string(),
  ordinal: z.number().int().nonnegative(),
});

export const publicDocsSearchSchema = z.object({
  workspaceId: z.string().min(1),
  query: z.string().min(1),
  knowledgeBaseIds: z.array(z.string().min(1)).default([]),
});

export const publicDocsAskSchema = z.object({
  workspaceId: z.string().min(1),
  question: z.string().min(1),
  knowledgeBaseIds: z.array(z.string().min(1)).default([]),
});

export const publicDocsQuerySchema = z.object({
  question: z.string().min(1),
  knowledgeBaseSlugs: z.array(z.string().min(1)).default([]),
});

export const publicDocLinkSchema = z.object({
  knowledgeBaseId: z.string().min(1),
  knowledgeBaseName: z.string().min(1),
  knowledgeBaseSlug: z.string().min(1),
  entryId: z.string().min(1),
  entrySlug: z.string().min(1),
  title: z.string().min(1),
  category: z.string().nullable(),
  summary: z.string(),
  updatedAt: z.string(),
});

export const publicDocsGroupSchema = z.object({
  knowledgeBaseId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  entries: z.array(publicDocLinkSchema),
});

export const publicDocsIndexSchema = z.object({
  knowledgeBases: z.array(publicDocsGroupSchema),
});

export const publicDocDetailSchema = z.object({
  knowledgeBaseId: z.string().min(1),
  knowledgeBaseName: z.string().min(1),
  knowledgeBaseSlug: z.string().min(1),
  entryId: z.string().min(1),
  entrySlug: z.string().min(1),
  title: z.string().min(1),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  updatedAt: z.string(),
  content: z.string(),
  relatedEntries: z.array(publicDocLinkSchema),
});

export const publicSearchResultSchema = z.object({
  question: z.string(),
  results: z.array(
    publicDocLinkSchema.extend({
      chunkId: z.string().min(1),
      score: z.number(),
      excerpt: z.string(),
    }),
  ),
});

export const publicAskResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(z.string()),
  confidence: z.number(),
  needsHuman: z.boolean(),
  sources: z.array(
    publicDocLinkSchema.extend({
      chunkId: z.string().min(1),
      score: z.number(),
      excerpt: z.string(),
    }),
  ),
});

export const knowledgeBaseCreateSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
});

export const knowledgeBaseUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
});

export const knowledgeEntryCreateSchema = z.object({
  workspaceId: z.string().min(1),
  knowledgeBaseId: z.string().min(1),
  type: entryTypeSchema,
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  visibility: visibilitySchema.default("guild"),
  status: entryStatusSchema.default("published"),
});

export const knowledgeEntryUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  visibility: visibilitySchema.optional(),
  status: entryStatusSchema.optional(),
});

export const providerSettingsSchema = z.object({
  provider: z.literal("openai").default("openai"),
  answerModel: z.string().min(1),
  fallbackModel: z.string().min(1).optional(),
  embeddingModel: z.string().min(1),
  storeResponses: z.boolean().default(false),
  chunkSize: z.number().int().positive().default(700),
  chunkOverlap: z.number().int().nonnegative().default(120),
  maxContextChunks: z.number().int().positive().default(4),
  secretRef: z.string().optional(),
  apiKey: z.string().optional(),
  hasStoredSecret: z.boolean().optional(),
});

export const discordSettingsSchema = z.object({
  clientId: z.string().optional(),
  guildId: z.string().optional(),
  mentionOnly: z.boolean().default(true),
  allowedChannelIds: z.array(z.string()).default([]),
  handoffMessage: z
    .string()
    .default("A human teammate will follow up soon."),
  botToken: z.string().optional(),
  hasStoredBotToken: z.boolean().optional(),
});

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authBootstrapSchema = authLoginSchema.extend({
  name: z.string().min(1),
});

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.literal("admin"),
});

export const authSessionSchema = z.object({
  token: z.string().min(1),
  user: authUserSchema,
});

export const encryptedSecretPayloadSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  authTag: z.string().min(1),
  keyVersion: z.number().int().positive(),
});

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  services: z.record(
    z.string(),
    z.object({
      ok: z.boolean(),
      detail: z.string().optional(),
    }),
  ),
});

export const embeddedChunkSchema = z.object({
  chunkId: z.string().min(1),
  workspaceId: z.string().min(1),
  knowledgeBaseId: z.string().min(1),
  entryId: z.string().min(1),
  versionId: z.string().min(1),
  content: z.string().min(1),
  ordinal: z.number().int().nonnegative(),
  tokenCount: z.number().int().positive(),
  embedding: z.array(z.number()),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type EntryType = z.infer<typeof entryTypeSchema>;
export type EntryStatus = z.infer<typeof entryStatusSchema>;
export type EntryVersionStatus = z.infer<typeof entryVersionStatusSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type IndexJobType = z.infer<typeof indexJobTypeSchema>;
export type IndexJobStatus = z.infer<typeof indexJobStatusSchema>;
export type QueryRequest = z.infer<typeof queryRequestSchema>;
export type StructuredAnswer = z.infer<typeof structuredAnswerSchema>;
export type TokenUsageSnapshot = z.infer<typeof tokenUsageSchema>;
export type SearchHit = z.infer<typeof searchHitSchema>;
export type QueryResponse = z.infer<typeof queryResponseSchema>;
export type QueryPreviewResponse = z.infer<typeof queryPreviewResponseSchema>;
export type SourceLookupRequest = z.infer<typeof sourceLookupRequestSchema>;
export type SourceLookupItem = z.infer<typeof sourceLookupItemSchema>;
export type PublicDocsQuery = z.infer<typeof publicDocsQuerySchema>;
export type PublicDocLink = z.infer<typeof publicDocLinkSchema>;
export type PublicDocsGroup = z.infer<typeof publicDocsGroupSchema>;
export type PublicDocsIndex = z.infer<typeof publicDocsIndexSchema>;
export type PublicDocDetail = z.infer<typeof publicDocDetailSchema>;
export type PublicSearchResult = z.infer<typeof publicSearchResultSchema>;
export type PublicAskResponse = z.infer<typeof publicAskResponseSchema>;
export type KnowledgeBaseCreateInput = z.infer<typeof knowledgeBaseCreateSchema>;
export type KnowledgeBaseUpdateInput = z.infer<typeof knowledgeBaseUpdateSchema>;
export type KnowledgeEntryCreateInput = z.infer<typeof knowledgeEntryCreateSchema>;
export type KnowledgeEntryUpdateInput = z.infer<typeof knowledgeEntryUpdateSchema>;
export type ProviderSettingsInput = z.infer<typeof providerSettingsSchema>;
export type DiscordSettingsInput = z.infer<typeof discordSettingsSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type AuthBootstrapInput = z.infer<typeof authBootstrapSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type EncryptedSecretPayload = z.infer<typeof encryptedSecretPayloadSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type EmbeddedChunk = z.infer<typeof embeddedChunkSchema>;
