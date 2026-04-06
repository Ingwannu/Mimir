import "dotenv/config";

import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";

import {
  OpenAiAnswerProvider,
  OpenAiEmbeddingProvider,
} from "@mimir/ai";
import { createCoreServices } from "@mimir/core";
import { createDatabaseConnection, runMigrations } from "@mimir/db";
import {
  authBootstrapSchema,
  authLoginSchema,
  discordSettingsSchema,
  knowledgeBaseCreateSchema,
  knowledgeBaseUpdateSchema,
  knowledgeEntryCreateSchema,
  knowledgeEntryUpdateSchema,
  parseApiEnv,
  providerSettingsSchema,
  queryRequestSchema,
} from "@mimir/shared";
import { createVectorStore } from "@mimir/vector";

const idParamSchema = z.object({ id: z.string().min(1) });
const sourceLookupSchema = z.object({
  citations: z.array(z.string().min(1)).optional(),
  citationIds: z.array(z.string().min(1)).optional(),
});

async function main(): Promise<void> {
  const env = parseApiEnv(process.env);
  const connection = createDatabaseConnection(env.DATABASE_URL);
  let services: ReturnType<typeof createCoreServices>;

  const vectorStore = createVectorStore(
    env.VECTOR_BACKEND === "pgvector"
      ? {
          backend: "pgvector",
          connectionString: env.DATABASE_URL,
        }
      : {
          backend: "qdrant",
          url: env.QDRANT_URL,
          collectionName: env.QDRANT_COLLECTION,
          vectorSize: 1536,
        },
  );

  const answerProvider = new OpenAiAnswerProvider({
    answerModel: env.OPENAI_ANSWER_MODEL,
    embeddingModel: env.OPENAI_EMBEDDING_MODEL,
    storeResponses: env.OPENAI_STORE,
    apiKeyResolver: async () => services.getOpenAiApiKey(),
    ...(env.OPENAI_API_KEY ? { apiKey: env.OPENAI_API_KEY } : {}),
    ...(env.OPENAI_FALLBACK_MODEL
      ? { fallbackModel: env.OPENAI_FALLBACK_MODEL }
      : {}),
  });

  const embeddingProvider = new OpenAiEmbeddingProvider({
    answerModel: env.OPENAI_ANSWER_MODEL,
    embeddingModel: env.OPENAI_EMBEDDING_MODEL,
    storeResponses: env.OPENAI_STORE,
    apiKeyResolver: async () => services.getOpenAiApiKey(),
    ...(env.OPENAI_API_KEY ? { apiKey: env.OPENAI_API_KEY } : {}),
    ...(env.OPENAI_FALLBACK_MODEL
      ? { fallbackModel: env.OPENAI_FALLBACK_MODEL }
      : {}),
  });

  services = createCoreServices({
    db: connection.db,
    pool: connection.pool,
    vectorStore,
    answerProvider,
    embeddingProvider,
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

  await runMigrations(connection.db);
  await services.bootstrapWorkspace();

  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/admin")) {
      return;
    }

    const authHeader = request.headers.authorization;
    const headerToken =
      typeof request.headers["x-admin-token"] === "string"
        ? request.headers["x-admin-token"]
        : undefined;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : undefined;

    if (env.ADMIN_TOKEN && headerToken === env.ADMIN_TOKEN) {
      return;
    }

    if (bearerToken && (await services.getSession(bearerToken))) {
      return;
    }

    return reply.status(401).send({
      message: "Admin token or session is required for this route.",
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    if (error instanceof z.ZodError) {
      reply.status(400).send({
        message: "Validation failed.",
        issues: error.issues,
      });
      return;
    }

    const statusCode =
      typeof (error as { statusCode?: number }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;

    reply.status(statusCode).send({
      message: getErrorMessage(error),
    });
  });

  app.get("/", async () => ({
    name: "mimir-api",
    version: "0.1.0",
  }));

  app.get("/v1/health", async () => services.getHealth());
  app.get("/v1/models", async () => services.getProviderSettings());

  app.get("/v1/auth/status", async () => ({
    needsBootstrap: !(await services.hasUsers()),
  }));
  app.get("/v1/auth/bootstrap-status", async () => ({
    needsBootstrap: !(await services.hasUsers()),
  }));

  app.post("/v1/auth/bootstrap", async (request) => {
    const parsed = authBootstrapSchema.parse(request.body);
    return services.bootstrapAdmin(parsed);
  });

  app.post("/v1/auth/login", async (request) => {
    const parsed = authLoginSchema.parse(request.body);
    return services.login(parsed);
  });

  app.get("/v1/auth/session", async (request, reply) => {
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : undefined;
    const headerToken =
      typeof request.headers["x-session-token"] === "string"
        ? request.headers["x-session-token"]
        : undefined;
    const sessionToken = bearerToken ?? headerToken;

    if (!sessionToken) {
      return reply.status(401).send({ message: "Session token is required." });
    }

    const session = await services.getSession(sessionToken);

    if (!session) {
      return reply.status(401).send({ message: "Session is not valid." });
    }

    return { user: session };
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : undefined;
    const headerToken =
      typeof request.headers["x-session-token"] === "string"
        ? request.headers["x-session-token"]
        : undefined;
    const sessionToken = bearerToken ?? headerToken;

    if (sessionToken) {
      await services.logout(sessionToken);
    }

    return reply.status(204).send();
  });

  app.post("/v1/query", async (request) => {
    const parsed = queryRequestSchema.parse({
      ...(request.body as Record<string, unknown>),
      workspaceId:
        (request.body as Record<string, unknown> | undefined)?.workspaceId ??
        env.WORKSPACE_ID,
    });

    return services.query(parsed);
  });

  app.post("/v1/query/preview", async (request) => {
    const parsed = queryRequestSchema.parse({
      ...(request.body as Record<string, unknown>),
      workspaceId:
        (request.body as Record<string, unknown> | undefined)?.workspaceId ??
        env.WORKSPACE_ID,
    });

    return services.preview(parsed);
  });

  app.post("/v1/query/sources", async (request) => {
    const parsed = sourceLookupSchema.parse(request.body);
    return services.lookupSources(parsed.citations ?? parsed.citationIds ?? []);
  });

  app.get("/v1/admin/dashboard", async () => services.getDashboardSummary());
  app.get("/v1/admin/summary", async () => services.getDashboardSummary());

  app.get("/v1/admin/kbs", async () => services.listKnowledgeBases());

  app.get("/v1/admin/kbs/:id", async (request) => {
    const params = idParamSchema.parse(request.params);
    const knowledgeBase = await services.getKnowledgeBase(params.id);

    if (!knowledgeBase) {
      const error = new Error(
        `Knowledge base ${params.id} was not found.`,
      ) as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    return knowledgeBase;
  });

  app.post("/v1/admin/kbs", async (request) => {
    const parsed = knowledgeBaseCreateSchema.parse({
      ...(request.body as Record<string, unknown>),
      workspaceId: env.WORKSPACE_ID,
    });

    return services.createKnowledgeBase(parsed);
  });

  app.patch("/v1/admin/kbs/:id", async (request) => {
    const params = idParamSchema.parse(request.params);
    const body = knowledgeBaseUpdateSchema.parse(request.body);
    return services.updateKnowledgeBase(params.id, body);
  });

  app.delete("/v1/admin/kbs/:id", async (request) => {
    const params = idParamSchema.parse(request.params);
    return services.deleteKnowledgeBase(params.id);
  });

  app.get("/v1/admin/entries", async (request) => {
    const query = z
      .object({
        knowledgeBaseId: z.string().optional(),
      })
      .parse(request.query);

    return services.listEntries(query.knowledgeBaseId);
  });

  app.post("/v1/admin/entries", async (request) => {
    const parsed = knowledgeEntryCreateSchema.parse({
      ...(request.body as Record<string, unknown>),
      workspaceId: env.WORKSPACE_ID,
    });

    return services.createEntry(parsed);
  });

  app.get("/v1/admin/entries/:id", async (request) => {
    const params = idParamSchema.parse(request.params);
    const entry = await services.getEntry(params.id);

    if (!entry) {
      const error = new Error(`Entry ${params.id} was not found.`) as Error & {
        statusCode?: number;
      };
      error.statusCode = 404;
      throw error;
    }

    return entry;
  });

  app.patch("/v1/admin/entries/:id", async (request) => {
    const params = idParamSchema.parse(request.params);
    const body = knowledgeEntryUpdateSchema.parse(request.body);
    return services.updateEntry(params.id, body);
  });

  app.delete("/v1/admin/entries/:id", async (request) => {
    const params = idParamSchema.parse(request.params);
    return services.deleteEntry(params.id);
  });

  app.post("/v1/admin/entries/:id/reindex", async (request) => {
    const params = idParamSchema.parse(request.params);
    return services.reindexEntry(params.id);
  });

  app.get("/v1/admin/jobs", async () => services.listJobs());
  app.get("/v1/admin/logs", async () => services.listQueryLogs());
  app.get("/v1/admin/analytics", async (request) => {
    const query = z
      .object({
        period: z.enum(["24h", "7d", "30d", "all"]).optional(),
      })
      .parse(request.query);

    return services.getAnalytics(query.period ?? "all");
  });
  app.get("/v1/admin/analytics/series", async (request) => {
    const query = z
      .object({
        period: z.enum(["24h", "7d", "30d", "all"]).optional(),
      })
      .parse(request.query);

    return services.getAnalyticsSeries(query.period ?? "all");
  });

  app.post("/v1/admin/jobs/:id/retry", async (request) => {
    const params = idParamSchema.parse(request.params);
    return services.retryJob(params.id);
  });

  app.get("/v1/admin/settings/provider", async () =>
    services.getProviderSettings(),
  );

  app.put("/v1/admin/settings/provider", async (request) => {
    const parsed = providerSettingsSchema.parse(request.body);
    return services.updateProviderSettings(parsed);
  });

  app.get("/v1/admin/settings/discord", async () =>
    services.getDiscordSettings(),
  );

  app.get("/v1/admin/runtime/discord", async () => {
    const settings = await services.getDiscordSettings();
    const botToken = await services.getDiscordBotToken();

    return {
      ...settings,
      botToken,
    };
  });

  app.put("/v1/admin/settings/discord", async (request) => {
    const parsed = discordSettingsSchema.parse(request.body);
    return services.updateDiscordSettings(parsed);
  });

  await app.listen({
    host: "0.0.0.0",
    port: env.API_PORT,
  });

  const shutdown = async () => {
    await app.close();
    await connection.pool.end();
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("API failed to start.", getErrorMessage(error));
  process.exitCode = 1;
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
