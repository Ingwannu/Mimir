import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const pgVector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return parsePgVector(String(value));
  },
});

export const entryTypeEnum = pgEnum("entry_type", ["faq", "article"]);
export const entryStatusEnum = pgEnum("entry_status", [
  "draft",
  "published",
  "archived",
]);
export const entryVersionStatusEnum = pgEnum("entry_version_status", [
  "queued",
  "processing",
  "ready",
  "failed",
]);
export const visibilityEnum = pgEnum("entry_visibility", [
  "internal",
  "guild",
  "public",
]);
export const indexJobTypeEnum = pgEnum("index_job_type", [
  "ingest_text",
  "ingest_file",
  "reindex_item",
  "reindex_kb",
  "delete_item_vectors",
  "full_reembed",
]);
export const indexJobStatusEnum = pgEnum("index_job_status", [
  "queued",
  "processing",
  "failed",
  "done",
]);
export const userRoleEnum = pgEnum("user_role", ["admin"]);

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slugIndex: uniqueIndex("workspaces_slug_idx").on(table.slug),
  }),
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull().default("admin"),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailIndex: uniqueIndex("users_workspace_email_idx").on(
      table.workspaceId,
      table.email,
    ),
  }),
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenHashIndex: uniqueIndex("auth_sessions_token_hash_idx").on(
      table.sessionTokenHash,
    ),
    userIndex: index("auth_sessions_user_idx").on(table.userId),
  }),
);

export const encryptedSecrets = pgTable(
  "encrypted_secrets",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceScopeIndex: uniqueIndex("encrypted_secrets_workspace_scope_idx").on(
      table.workspaceId,
      table.scope,
    ),
  }),
);

export const discordGuilds = pgTable(
  "discord_guilds",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name"),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceIndex: index("discord_guilds_workspace_idx").on(table.workspaceId),
  }),
);

export const knowledgeBases = pgTable(
  "knowledge_bases",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceIndex: index("knowledge_bases_workspace_idx").on(table.workspaceId),
    workspaceSlugIndex: uniqueIndex("knowledge_bases_workspace_slug_idx").on(
      table.workspaceId,
      table.slug,
    ),
  }),
);

export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    knowledgeBaseId: text("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    type: entryTypeEnum("type").notNull(),
    title: text("title").notNull(),
    status: entryStatusEnum("status").notNull().default("draft"),
    activeVersionId: text("active_version_id"),
    category: text("category"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    visibility: visibilityEnum("visibility").notNull().default("guild"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceIndex: index("knowledge_entries_workspace_idx").on(table.workspaceId),
    knowledgeBaseIndex: index("knowledge_entries_kb_idx").on(table.knowledgeBaseId),
  }),
);

export const entryVersions = pgTable(
  "entry_versions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    knowledgeBaseId: text("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => knowledgeEntries.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    sourceType: text("source_type").notNull().default("text"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    checksum: text("checksum"),
    status: entryVersionStatusEnum("status").notNull().default("queued"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
  },
  (table) => ({
    entryIndex: index("entry_versions_entry_idx").on(table.entryId),
    versionIndex: uniqueIndex("entry_versions_entry_version_idx").on(
      table.entryId,
      table.versionNumber,
    ),
  }),
);

export const chunks = pgTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    knowledgeBaseId: text("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => knowledgeEntries.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => entryVersions.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    versionIndex: index("chunks_version_idx").on(table.versionId),
    entryVersionOrdinalIndex: uniqueIndex("chunks_version_ordinal_idx").on(
      table.versionId,
      table.ordinal,
    ),
  }),
);

export const pgvectorChunkEmbeddings = pgTable(
  "pgvector_chunk_embeddings",
  {
    chunkId: text("chunk_id")
      .primaryKey()
      .references(() => chunks.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    knowledgeBaseId: text("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => knowledgeEntries.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => entryVersions.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    embedding: pgVector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceIndex: index("pgvector_embeddings_workspace_idx").on(table.workspaceId),
    versionIndex: index("pgvector_embeddings_version_idx").on(table.versionId),
  }),
);

export const indexJobs = pgTable(
  "index_jobs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    knowledgeBaseId: text("knowledge_base_id").references(() => knowledgeBases.id, {
      onDelete: "cascade",
    }),
    entryId: text("entry_id").references(() => knowledgeEntries.id, {
      onDelete: "cascade",
    }),
    versionId: text("version_id").references(() => entryVersions.id, {
      onDelete: "cascade",
    }),
    jobType: indexJobTypeEnum("job_type").notNull(),
    status: indexJobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lockedBy: text("locked_by"),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    error: text("error"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    statusIndex: index("index_jobs_status_idx").on(table.status, table.availableAt),
  }),
);

export const providerSettings = pgTable(
  "provider_settings",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("openai"),
    secretRef: text("secret_ref"),
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceProviderIndex: uniqueIndex("provider_settings_workspace_provider_idx").on(
      table.workspaceId,
      table.provider,
    ),
  }),
);

export const modelProfiles = pgTable(
  "model_profiles",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    answerModel: text("answer_model").notNull(),
    fallbackModel: text("fallback_model"),
    embeddingModel: text("embedding_model").notNull(),
    storeResponses: boolean("store_responses").notNull().default(false),
    chunkSize: integer("chunk_size").notNull().default(700),
    chunkOverlap: integer("chunk_overlap").notNull().default(120),
    maxContextChunks: integer("max_context_chunks").notNull().default(4),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceIndex: uniqueIndex("model_profiles_workspace_idx").on(table.workspaceId),
  }),
);

export const queryLogs = pgTable(
  "query_logs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    guildId: text("guild_id"),
    channelId: text("channel_id"),
    userId: text("user_id"),
    question: text("question").notNull(),
    normalizedQuestion: text("normalized_question"),
    answer: text("answer"),
    citations: jsonb("citations").$type<string[]>().notNull().default([]),
    confidence: doublePrecision("confidence"),
    needsHuman: boolean("needs_human").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceIndex: index("query_logs_workspace_idx").on(table.workspaceId, table.createdAt),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: text("actor_id"),
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceIndex: index("audit_logs_workspace_idx").on(table.workspaceId, table.createdAt),
  }),
);

export type Workspace = typeof workspaces.$inferSelect;
export type User = typeof users.$inferSelect;
export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type EntryVersion = typeof entryVersions.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type IndexJob = typeof indexJobs.$inferSelect;
export type PgvectorChunkEmbedding = typeof pgvectorChunkEmbeddings.$inferSelect;

function parsePgVector(value: string): number[] {
  const normalized = value.trim().replace(/^\[/, "").replace(/\]$/, "");

  if (normalized.length === 0) {
    return [];
  }

  return normalized.split(",").map((item) => Number(item.trim()));
}
