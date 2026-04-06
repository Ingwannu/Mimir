import { QdrantClient } from "@qdrant/js-client-rest";
import { Pool } from "pg";

import type { EmbeddedChunk, SearchHit } from "@mimir/shared";

export interface VectorQueryInput {
  workspaceId: string;
  knowledgeBaseIds?: string[] | undefined;
  vector: number[];
  topK: number;
  filter?: Record<string, unknown> | undefined;
}

export interface DeleteByVersionInput {
  workspaceId: string;
  knowledgeBaseId?: string | undefined;
  entryId?: string | undefined;
  versionId?: string | undefined;
}

export interface VectorHealth {
  ok: boolean;
  detail?: string;
}

export interface VectorStoreAdapter {
  health(): Promise<VectorHealth>;
  upsertChunks(chunks: EmbeddedChunk[]): Promise<void>;
  query(input: VectorQueryInput): Promise<SearchHit[]>;
  deleteByItemVersion(input: DeleteByVersionInput): Promise<void>;
}

export type VectorBackend = "qdrant" | "pgvector";

export type VectorStoreConfig =
  | ({
      backend: "qdrant";
    } & QdrantVectorStoreOptions)
  | ({
      backend: "pgvector";
    } & PgVectorStoreOptions);

export interface QdrantVectorStoreOptions {
  url: string;
  collectionName: string;
  apiKey?: string | undefined;
  vectorSize?: number | undefined;
}

export interface PgVectorStoreOptions {
  connectionString: string;
  tableName?: string | undefined;
  vectorDimensions?: number | undefined;
}

export class QdrantVectorStore implements VectorStoreAdapter {
  private readonly client: QdrantClient;

  private readonly collectionName: string;

  private readonly vectorSize: number;

  private collectionReady?: Promise<void>;

  public constructor(options: QdrantVectorStoreOptions) {
    const clientOptions: { url: string; apiKey?: string } = {
      url: options.url,
    };

    if (options.apiKey) {
      clientOptions.apiKey = options.apiKey;
    }

    this.client = new QdrantClient(clientOptions);
    this.collectionName = options.collectionName;
    this.vectorSize = options.vectorSize ?? 1536;
  }

  public async health(): Promise<VectorHealth> {
    try {
      await this.client.getCollections();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : "Unknown Qdrant error",
      };
    }
  }

  public async upsertChunks(chunks: EmbeddedChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    await this.ensureCollection();

    await this.client.upsert(this.collectionName, {
      wait: true,
      points: chunks.map((chunk) => ({
        id: chunk.chunkId,
        vector: chunk.embedding,
        payload: {
          workspaceId: chunk.workspaceId,
          knowledgeBaseId: chunk.knowledgeBaseId,
          entryId: chunk.entryId,
          versionId: chunk.versionId,
          content: chunk.content,
          ordinal: chunk.ordinal,
          tokenCount: chunk.tokenCount,
          ...chunk.payload,
        },
      })),
    });
  }

  public async query(input: VectorQueryInput): Promise<SearchHit[]> {
    await this.ensureCollection();

    const points = (await this.client.search(this.collectionName, {
      vector: input.vector,
      limit: input.topK,
      filter: this.buildFilter(input),
      with_payload: true,
    })) as Array<{
      id: string | number;
      score: number;
      payload?: Record<string, unknown>;
    }>;

    return points.map((point) => {
      const payload = point.payload ?? {};

      return {
        chunkId: String(point.id),
        workspaceId: String(payload.workspaceId ?? input.workspaceId),
        knowledgeBaseId: String(payload.knowledgeBaseId ?? ""),
        entryId: String(payload.entryId ?? ""),
        versionId: String(payload.versionId ?? ""),
        score: point.score,
        content: String(payload.content ?? ""),
        payload,
      };
    });
  }

  public async deleteByItemVersion(
    input: DeleteByVersionInput,
  ): Promise<void> {
    await this.ensureCollection();

    await this.client.delete(this.collectionName, {
      wait: true,
      filter: this.buildDeleteFilter(input),
    });
  }

  private async ensureCollection(): Promise<void> {
    if (!this.collectionReady) {
      this.collectionReady = this.ensureCollectionInternal();
    }

    await this.collectionReady;
  }

  private async ensureCollectionInternal(): Promise<void> {
    const existsResponse = (await this.client.collectionExists(
      this.collectionName,
    )) as boolean | { exists?: boolean };
    const exists =
      typeof existsResponse === "boolean"
        ? existsResponse
        : Boolean(existsResponse.exists);

    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: "Cosine",
        },
      });
    }

    await Promise.all(
      ["workspaceId", "knowledgeBaseId", "entryId", "versionId"].map(
        async (fieldName) => {
          try {
            await this.client.createPayloadIndex(this.collectionName, {
              field_name: fieldName,
              field_schema: "keyword",
            });
          } catch {
            // Payload indexes are idempotent for this scaffold.
          }
        },
      ),
    );
  }

  private buildFilter(input: VectorQueryInput): Record<string, unknown> {
    const must: Array<Record<string, unknown>> = [
      {
        key: "workspaceId",
        match: { value: input.workspaceId },
      },
    ];

    if (input.knowledgeBaseIds && input.knowledgeBaseIds.length > 0) {
      must.push({
        key: "knowledgeBaseId",
        match:
          input.knowledgeBaseIds.length === 1
            ? { value: input.knowledgeBaseIds[0] }
            : { any: input.knowledgeBaseIds },
      });
    }

    if (input.filter) {
      for (const [key, value] of Object.entries(input.filter)) {
        if (Array.isArray(value)) {
          must.push({ key, match: { any: value } });
          continue;
        }

        must.push({ key, match: { value } });
      }
    }

    return { must };
  }

  private buildDeleteFilter(
    input: DeleteByVersionInput,
  ): Record<string, unknown> {
    const must: Array<Record<string, unknown>> = [
      {
        key: "workspaceId",
        match: { value: input.workspaceId },
      },
    ];

    if (input.knowledgeBaseId) {
      must.push({
        key: "knowledgeBaseId",
        match: { value: input.knowledgeBaseId },
      });
    }

    if (input.entryId) {
      must.push({
        key: "entryId",
        match: { value: input.entryId },
      });
    }

    if (input.versionId) {
      must.push({
        key: "versionId",
        match: { value: input.versionId },
      });
    }

    return { must };
  }
}

export class PgVectorStore implements VectorStoreAdapter {
  private readonly pool: Pool;

  private readonly tableName: string;

  private readonly vectorDimensions: number;

  public constructor(options: PgVectorStoreOptions) {
    this.pool = new Pool({
      connectionString: options.connectionString,
      max: 10,
    });
    this.tableName = options.tableName ?? "pgvector_chunk_embeddings";
    this.vectorDimensions = options.vectorDimensions ?? 1536;
  }

  public async health(): Promise<VectorHealth> {
    try {
      const result = await this.pool.query(
        "select extname from pg_extension where extname = 'vector'",
      );

      if (result.rowCount === 0) {
        return {
          ok: false,
          detail: "pgvector extension is not installed in the database.",
        };
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        detail:
          error instanceof Error ? error.message : "Unknown pgvector error",
      };
    }
  }

  public async upsertChunks(chunks: EmbeddedChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const query = `
        insert into "${this.tableName}" (
          "chunk_id",
          "workspace_id",
          "knowledge_base_id",
          "entry_id",
          "version_id",
          "content",
          "token_count",
          "payload",
          "embedding"
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::vector
        )
        on conflict ("chunk_id") do update
        set
          "workspace_id" = excluded."workspace_id",
          "knowledge_base_id" = excluded."knowledge_base_id",
          "entry_id" = excluded."entry_id",
          "version_id" = excluded."version_id",
          "content" = excluded."content",
          "token_count" = excluded."token_count",
          "payload" = excluded."payload",
          "embedding" = excluded."embedding";
      `;

      for (const chunk of chunks) {
        await client.query(query, [
          chunk.chunkId,
          chunk.workspaceId,
          chunk.knowledgeBaseId,
          chunk.entryId,
          chunk.versionId,
          chunk.content,
          chunk.tokenCount,
          JSON.stringify(chunk.payload ?? {}),
          toVectorLiteral(chunk.embedding, this.vectorDimensions),
        ]);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async query(input: VectorQueryInput): Promise<SearchHit[]> {
    const whereClauses: string[] = ['"workspace_id" = $1'];
    const parameters: unknown[] = [input.workspaceId];
    let parameterIndex = 2;

    if (input.knowledgeBaseIds && input.knowledgeBaseIds.length > 0) {
      whereClauses.push(`"knowledge_base_id" = any($${parameterIndex})`);
      parameters.push(input.knowledgeBaseIds);
      parameterIndex += 1;
    }

    if (input.filter) {
      for (const [key, value] of Object.entries(input.filter)) {
        whereClauses.push(`"payload" @> $${parameterIndex}::jsonb`);
        parameters.push(JSON.stringify({ [key]: value }));
        parameterIndex += 1;
      }
    }

    parameters.push(toVectorLiteral(input.vector, this.vectorDimensions));
    parameters.push(input.topK);

    const distanceIndex = parameterIndex;
    const limitIndex = parameterIndex + 1;

    const result = await this.pool.query(
      `
        select
          "chunk_id",
          "workspace_id",
          "knowledge_base_id",
          "entry_id",
          "version_id",
          "content",
          "payload",
          1 - ("embedding" <=> $${distanceIndex}::vector) as score
        from "${this.tableName}"
        where ${whereClauses.join(" and ")}
        order by "embedding" <=> $${distanceIndex}::vector
        limit $${limitIndex};
      `,
      parameters,
    );

    return result.rows.map((row) => ({
      chunkId: String(row.chunk_id),
      workspaceId: String(row.workspace_id),
      knowledgeBaseId: String(row.knowledge_base_id),
      entryId: String(row.entry_id),
      versionId: String(row.version_id),
      content: String(row.content ?? ""),
      payload: parsePayload(row.payload),
      score: Number(row.score ?? 0),
    }));
  }

  public async deleteByItemVersion(
    input: DeleteByVersionInput,
  ): Promise<void> {
    const whereClauses: string[] = ['"workspace_id" = $1'];
    const parameters: unknown[] = [input.workspaceId];
    let parameterIndex = 2;

    if (input.knowledgeBaseId) {
      whereClauses.push(`"knowledge_base_id" = $${parameterIndex}`);
      parameters.push(input.knowledgeBaseId);
      parameterIndex += 1;
    }

    if (input.entryId) {
      whereClauses.push(`"entry_id" = $${parameterIndex}`);
      parameters.push(input.entryId);
      parameterIndex += 1;
    }

    if (input.versionId) {
      whereClauses.push(`"version_id" = $${parameterIndex}`);
      parameters.push(input.versionId);
      parameterIndex += 1;
    }

    await this.pool.query(
      `delete from "${this.tableName}" where ${whereClauses.join(" and ")};`,
      parameters,
    );
  }
}

export function createVectorStore(config: VectorStoreConfig): VectorStoreAdapter {
  if (config.backend === "pgvector") {
    return new PgVectorStore(config);
  }

  return new QdrantVectorStore(config);
}

function toVectorLiteral(values: number[], dimensions: number): string {
  if (values.length !== dimensions) {
    throw new Error(
      `Expected vector with ${dimensions} dimensions but received ${values.length}.`,
    );
  }

  return `[${values.join(",")}]`;
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return {};
}
