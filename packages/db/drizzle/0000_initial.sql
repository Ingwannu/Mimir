CREATE TYPE "entry_type" AS ENUM ('faq', 'article');
CREATE TYPE "entry_status" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "entry_version_status" AS ENUM ('queued', 'processing', 'ready', 'failed');
CREATE TYPE "entry_visibility" AS ENUM ('internal', 'guild', 'public');
CREATE TYPE "index_job_type" AS ENUM ('ingest_text', 'ingest_file', 'reindex_item', 'reindex_kb', 'delete_item_vectors', 'full_reembed');
CREATE TYPE "index_job_status" AS ENUM ('queued', 'processing', 'failed', 'done');

CREATE TABLE "workspaces" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "workspaces_slug_idx" ON "workspaces" ("slug");

CREATE TABLE "discord_guilds" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "name" text,
  "settings" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "discord_guilds_workspace_idx" ON "discord_guilds" ("workspace_id");

CREATE TABLE "knowledge_bases" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "knowledge_bases_workspace_idx" ON "knowledge_bases" ("workspace_id");
CREATE UNIQUE INDEX "knowledge_bases_workspace_slug_idx" ON "knowledge_bases" ("workspace_id", "slug");

CREATE TABLE "knowledge_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "knowledge_base_id" text NOT NULL REFERENCES "knowledge_bases" ("id") ON DELETE cascade,
  "type" "entry_type" NOT NULL,
  "title" text NOT NULL,
  "status" "entry_status" NOT NULL DEFAULT 'draft',
  "active_version_id" text,
  "category" text,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "visibility" "entry_visibility" NOT NULL DEFAULT 'guild',
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "knowledge_entries_workspace_idx" ON "knowledge_entries" ("workspace_id");
CREATE INDEX "knowledge_entries_kb_idx" ON "knowledge_entries" ("knowledge_base_id");

CREATE TABLE "entry_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "knowledge_base_id" text NOT NULL REFERENCES "knowledge_bases" ("id") ON DELETE cascade,
  "entry_id" text NOT NULL REFERENCES "knowledge_entries" ("id") ON DELETE cascade,
  "version_number" integer NOT NULL,
  "source_type" text NOT NULL DEFAULT 'text',
  "title" text NOT NULL,
  "content" text NOT NULL,
  "checksum" text,
  "status" "entry_version_status" NOT NULL DEFAULT 'queued',
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "indexed_at" timestamptz
);
CREATE INDEX "entry_versions_entry_idx" ON "entry_versions" ("entry_id");
CREATE UNIQUE INDEX "entry_versions_entry_version_idx" ON "entry_versions" ("entry_id", "version_number");

CREATE TABLE "chunks" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "knowledge_base_id" text NOT NULL REFERENCES "knowledge_bases" ("id") ON DELETE cascade,
  "entry_id" text NOT NULL REFERENCES "knowledge_entries" ("id") ON DELETE cascade,
  "version_id" text NOT NULL REFERENCES "entry_versions" ("id") ON DELETE cascade,
  "ordinal" integer NOT NULL,
  "content" text NOT NULL,
  "token_count" integer NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "chunks_version_idx" ON "chunks" ("version_id");
CREATE UNIQUE INDEX "chunks_version_ordinal_idx" ON "chunks" ("version_id", "ordinal");

CREATE TABLE "index_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "knowledge_base_id" text REFERENCES "knowledge_bases" ("id") ON DELETE cascade,
  "entry_id" text REFERENCES "knowledge_entries" ("id") ON DELETE cascade,
  "version_id" text REFERENCES "entry_versions" ("id") ON DELETE cascade,
  "job_type" "index_job_type" NOT NULL,
  "status" "index_job_status" NOT NULL DEFAULT 'queued',
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "locked_by" text,
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "error" text,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "started_at" timestamptz,
  "completed_at" timestamptz
);
CREATE INDEX "index_jobs_status_idx" ON "index_jobs" ("status", "available_at");

CREATE TABLE "provider_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "provider" text NOT NULL DEFAULT 'openai',
  "secret_ref" text,
  "config" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "provider_settings_workspace_provider_idx" ON "provider_settings" ("workspace_id", "provider");

CREATE TABLE "model_profiles" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "answer_model" text NOT NULL,
  "fallback_model" text,
  "embedding_model" text NOT NULL,
  "store_responses" boolean NOT NULL DEFAULT false,
  "chunk_size" integer NOT NULL DEFAULT 700,
  "chunk_overlap" integer NOT NULL DEFAULT 120,
  "max_context_chunks" integer NOT NULL DEFAULT 4,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "model_profiles_workspace_idx" ON "model_profiles" ("workspace_id");

CREATE TABLE "query_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "guild_id" text,
  "channel_id" text,
  "user_id" text,
  "question" text NOT NULL,
  "normalized_question" text,
  "answer" text,
  "citations" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "confidence" double precision,
  "needs_human" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "query_logs_workspace_idx" ON "query_logs" ("workspace_id", "created_at");

CREATE TABLE "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "actor_id" text,
  "actor_type" text NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "audit_logs_workspace_idx" ON "audit_logs" ("workspace_id", "created_at");
