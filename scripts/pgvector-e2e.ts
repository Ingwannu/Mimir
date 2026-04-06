import assert from "node:assert/strict";

import {
  OpenAiAnswerProvider,
  OpenAiEmbeddingProvider,
} from "@mimir/ai";
import { createCoreServices } from "@mimir/core";
import { createDatabaseConnection, runMigrations } from "@mimir/db";
import { createVectorStore } from "@mimir/vector";

const databaseUrl =
  process.env.PGVECTOR_DATABASE_URL ??
  "postgresql://mimir:mimir@127.0.0.1:5432/mimir";
const workspaceId = process.env.WORKSPACE_ID ?? "workspace_demo";
const workspaceSlug = process.env.WORKSPACE_SLUG ?? "mimir";
const workspaceName = process.env.WORKSPACE_NAME ?? "Mimir";

async function main(): Promise<void> {
  const connection = createDatabaseConnection(databaseUrl);
  const vectorStore = createVectorStore({
    backend: "pgvector",
    connectionString: databaseUrl,
    tableName: process.env.PGVECTOR_TABLE ?? "pgvector_chunk_embeddings",
    vectorDimensions: 1536,
  });
  const services = createCoreServices({
    db: connection.db,
    pool: connection.pool,
    vectorStore,
    answerProvider: new OpenAiAnswerProvider({
      answerModel: "gpt-5-nano",
      fallbackModel: "gpt-5-mini",
      embeddingModel: "text-embedding-3-small",
      storeResponses: false,
    }),
    embeddingProvider: new OpenAiEmbeddingProvider({
      answerModel: "gpt-5-nano",
      fallbackModel: "gpt-5-mini",
      embeddingModel: "text-embedding-3-small",
      storeResponses: false,
    }),
    workspace: {
      id: workspaceId,
      slug: workspaceSlug,
      name: workspaceName,
    },
    defaults: {
      answerModel: "gpt-5-nano",
      fallbackModel: "gpt-5-mini",
      embeddingModel: "text-embedding-3-small",
      storeResponses: false,
      chunkSize: 700,
      chunkOverlap: 120,
      maxContextChunks: 4,
    },
  });

  try {
    await runMigrations(connection.db);
    await services.bootstrapWorkspace();

    const knowledgeBase = await services.createKnowledgeBase({
      workspaceId,
      name: `Pgvector ${Date.now()}`,
      slug: `pgvector-${Date.now()}`,
      description: "pgvector end-to-end smoke",
    });

    const entry = await services.createEntry({
      workspaceId,
      knowledgeBaseId: knowledgeBase.id,
      type: "article",
      title: "Pgvector refund policy",
      content:
        "Refunds are available within 7 days of purchase. Customers should open a billing ticket to request a refund.",
      category: "billing",
      tags: ["refund", "pgvector"],
      visibility: "guild",
      status: "published",
    });

    let resultStatus = "queued";

    for (let attempt = 0; attempt < 15; attempt += 1) {
      const result = await services.runWorkerTick(`pgvector_smoke_${attempt}`);
      resultStatus = result.status ?? "idle";

      if (result.status === "done") {
        break;
      }

      if (result.status === "failed") {
        throw new Error(result.detail ?? "pgvector worker tick failed");
      }

      await sleep(250);
    }

    assert.equal(resultStatus, "done", "pgvector worker tick should complete");

    const query = await services.query({
      workspaceId,
      question: "How long do I have to ask for a refund?",
      knowledgeBaseIds: [knowledgeBase.id],
    });

    assert.ok(
      query.answer.includes("7 days"),
      "pgvector query answer should mention the refund window",
    );
    assert.ok(query.citations.length > 0, "pgvector query should return citations");

    console.log(
      JSON.stringify(
        {
          ok: true,
          knowledgeBaseId: knowledgeBase.id,
          entryId: entry.entryId,
          citations: query.citations,
          answer: query.answer,
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.pool.end();
  }
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
