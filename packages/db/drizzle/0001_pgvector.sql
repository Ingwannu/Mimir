CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "pgvector_chunk_embeddings" (
  "chunk_id" text PRIMARY KEY NOT NULL REFERENCES "chunks" ("id") ON DELETE cascade,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "knowledge_base_id" text NOT NULL REFERENCES "knowledge_bases" ("id") ON DELETE cascade,
  "entry_id" text NOT NULL REFERENCES "knowledge_entries" ("id") ON DELETE cascade,
  "version_id" text NOT NULL REFERENCES "entry_versions" ("id") ON DELETE cascade,
  "content" text NOT NULL,
  "token_count" integer NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "embedding" vector(1536) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "pgvector_embeddings_workspace_idx" ON "pgvector_chunk_embeddings" ("workspace_id");
CREATE INDEX "pgvector_embeddings_version_idx" ON "pgvector_chunk_embeddings" ("version_id");
CREATE INDEX "pgvector_embeddings_embedding_hnsw_idx" ON "pgvector_chunk_embeddings" USING hnsw ("embedding" vector_cosine_ops);
