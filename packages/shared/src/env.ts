import { z } from "zod";

const booleanStringSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const optionalString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const commonSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WORKSPACE_ID: z.string().min(1).default("workspace_demo"),
  WORKSPACE_SLUG: z.string().min(1).default("mimir"),
  WORKSPACE_NAME: z.string().min(1).default("Mimir"),
  ADMIN_TOKEN: optionalString,
  WEB_SESSION_SECRET: optionalString,
  SECRETS_ENCRYPTION_KEY: optionalString,
  VECTOR_BACKEND: z.enum(["qdrant", "pgvector"]).default("qdrant"),
  DISCORD_BOT_TOKEN: optionalString,
  DISCORD_CLIENT_ID: optionalString,
  DISCORD_GUILD_ID: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_ANSWER_MODEL: z.string().min(1).default("gpt-5-nano"),
  OPENAI_FALLBACK_MODEL: z.string().min(1).default("gpt-5-mini"),
  OPENAI_EMBEDDING_MODEL: z
    .string()
    .min(1)
    .default("text-embedding-3-small"),
  OPENAI_STORE: booleanStringSchema.default(false),
  CHUNK_SIZE: z.coerce.number().int().positive().default(700),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(120),
  MAX_CONTEXT_CHUNKS: z.coerce.number().int().positive().default(4),
});

const storageSchema = z.object({
  DATABASE_URL: z.string().min(1),
  QDRANT_URL: z.string().url(),
  QDRANT_COLLECTION: z.string().min(1).default("mimir_chunks"),
  QDRANT_PORT: z.coerce.number().int().positive().default(6334),
  PGVECTOR_TABLE: z.string().min(1).default("pgvector_chunk_embeddings"),
});

export const apiEnvSchema = commonSchema.extend(
  storageSchema.shape,
).extend({
  API_PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:4000"),
});

export const workerEnvSchema = commonSchema.extend(
  storageSchema.shape,
).extend({
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(4200),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(3000),
});

export const botEnvSchema = commonSchema.extend({
  BOT_HEALTH_PORT: z.coerce.number().int().positive().default(4100),
  PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:4000"),
});

export const webEnvSchema = z.object({
  WEB_API_BASE_URL: z.string().url().default("http://localhost:4000"),
  ADMIN_TOKEN: optionalString,
  WEB_SESSION_SECRET: optionalString,
});

export const databaseEnvSchema = storageSchema;

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type BotEnv = z.infer<typeof botEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export function parseApiEnv(env: NodeJS.ProcessEnv): ApiEnv {
  return apiEnvSchema.parse(env);
}

export function parseWorkerEnv(env: NodeJS.ProcessEnv): WorkerEnv {
  return workerEnvSchema.parse(env);
}

export function parseBotEnv(env: NodeJS.ProcessEnv): BotEnv {
  return botEnvSchema.parse(env);
}

export function parseWebEnv(env: NodeJS.ProcessEnv): WebEnv {
  return webEnvSchema.parse(env);
}

export function parseDatabaseEnv(env: NodeJS.ProcessEnv): DatabaseEnv {
  return databaseEnvSchema.parse(env);
}
