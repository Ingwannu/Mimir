import "dotenv/config";

import { createServer } from "node:http";

import {
  OpenAiAnswerProvider,
  OpenAiEmbeddingProvider,
} from "@wickedhostbotai/ai";
import { createCoreServices } from "@wickedhostbotai/core";
import { createDatabaseConnection, runMigrations } from "@wickedhostbotai/db";
import { parseWorkerEnv } from "@wickedhostbotai/shared";
import { createVectorStore } from "@wickedhostbotai/vector";

const env = parseWorkerEnv(process.env);
const connection = createDatabaseConnection(env.DATABASE_URL);
let services: ReturnType<typeof createCoreServices>;

services = createCoreServices({
  db: connection.db,
  pool: connection.pool,
  vectorStore: createVectorStore(
    env.VECTOR_BACKEND === "pgvector"
      ? {
          backend: "pgvector",
          connectionString: env.DATABASE_URL,
        }
      : {
          backend: "qdrant",
          url: env.QDRANT_URL,
          collectionName: env.QDRANT_COLLECTION,
        },
  ),
  answerProvider: new OpenAiAnswerProvider({
    apiKey: env.OPENAI_API_KEY,
    apiKeyResolver: async () => services.getOpenAiApiKey(),
    answerModel: env.OPENAI_ANSWER_MODEL,
    fallbackModel: env.OPENAI_FALLBACK_MODEL,
    embeddingModel: env.OPENAI_EMBEDDING_MODEL,
    storeResponses: env.OPENAI_STORE,
  }),
  embeddingProvider: new OpenAiEmbeddingProvider({
    apiKey: env.OPENAI_API_KEY,
    apiKeyResolver: async () => services.getOpenAiApiKey(),
    answerModel: env.OPENAI_ANSWER_MODEL,
    fallbackModel: env.OPENAI_FALLBACK_MODEL,
    embeddingModel: env.OPENAI_EMBEDDING_MODEL,
    storeResponses: env.OPENAI_STORE,
  }),
  workspace: {
    id: env.WORKSPACE_ID,
    slug: env.WORKSPACE_SLUG,
    name: env.WORKSPACE_NAME,
  },
  defaults: {
    chunkSize: env.CHUNK_SIZE,
    chunkOverlap: env.CHUNK_OVERLAP,
    maxContextChunks: env.MAX_CONTEXT_CHUNKS,
    answerModel: env.OPENAI_ANSWER_MODEL,
    fallbackModel: env.OPENAI_FALLBACK_MODEL,
    embeddingModel: env.OPENAI_EMBEDDING_MODEL,
    storeResponses: env.OPENAI_STORE,
  },
  security: {
    ...(env.SECRETS_ENCRYPTION_KEY
      ? { encryptionKey: env.SECRETS_ENCRYPTION_KEY }
      : {}),
    sessionTtlMs: 1000 * 60 * 60 * 24 * 14,
  },
});

const workerId = `worker_${process.pid}`;
let running = true;
let ready = false;
let lastResult: string | null = null;
let lastError: string | null = null;

const healthServer = createServer((_request, response) => {
  response.writeHead(200, {
    "content-type": "application/json",
  });
  response.end(
    JSON.stringify({
      ok: true,
      service: "worker",
      ready,
      workerId,
      lastResult,
      lastError,
    }),
  );
});

healthServer.listen(env.WORKER_HEALTH_PORT, "0.0.0.0", () => {
  console.log(`Worker health server listening on ${env.WORKER_HEALTH_PORT}.`);
});

async function main(): Promise<void> {
  await runMigrations(connection.db);
  await services.bootstrapWorkspace();
  ready = true;

  while (running) {
    try {
      const result = await services.runWorkerTick(workerId);
      lastResult = result.processed
        ? `${result.status ?? "done"}:${result.jobId ?? "unknown"}`
        : "idle";
      if (result.detail) {
        lastError = result.detail;
      } else if (result.processed) {
        lastError = null;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Worker tick failed";
      console.error("Worker tick failed.", error);
    }

    await sleep(env.WORKER_POLL_INTERVAL_MS);
  }
}

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function shutdown() {
  running = false;
  ready = false;
  healthServer.close();
  await connection.pool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => {
  lastError = error instanceof Error ? error.message : "Worker startup failed";
  console.error("Worker startup failed.", error);
  process.exitCode = 1;
});
