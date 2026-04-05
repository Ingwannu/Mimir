import { createHash, randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "@wickedhostbotai/db";
import {
  auditLogs,
  authSessions,
  chunks,
  checkDatabaseHealth,
  createId,
  discordGuilds,
  encryptedSecrets,
  entryVersions,
  indexJobs,
  knowledgeBases,
  knowledgeEntries,
  modelProfiles,
  providerSettings,
  queryLogs,
  users,
  workspaces,
} from "@wickedhostbotai/db";
import { buildAnswerPrompt, type AnswerProvider, type EmbeddingProvider } from "@wickedhostbotai/ai";
import type {
  AuthBootstrapInput,
  AuthLoginInput,
  AuthSession,
  AuthUser,
  DiscordSettingsInput,
  EmbeddedChunk,
  HealthResponse,
  KnowledgeBaseCreateInput,
  KnowledgeBaseUpdateInput,
  KnowledgeEntryCreateInput,
  KnowledgeEntryUpdateInput,
  ProviderSettingsInput,
  QueryPreviewResponse,
  QueryRequest,
  QueryResponse,
  SourceLookupItem,
} from "@wickedhostbotai/shared";
import type { VectorStoreAdapter } from "@wickedhostbotai/vector";
import {
  createSessionToken,
  decryptSecret,
  encryptSecret,
  hashPassword,
  hashToken,
  verifyPassword,
} from "./security.js";

export interface CoreServicesOptions {
  db: Database;
  pool: Parameters<typeof checkDatabaseHealth>[0];
  vectorStore: VectorStoreAdapter;
  answerProvider: AnswerProvider;
  embeddingProvider: EmbeddingProvider;
  workspace: {
    id: string;
    slug: string;
    name: string;
  };
  defaults: {
    chunkSize: number;
    chunkOverlap: number;
    maxContextChunks: number;
    answerModel: string;
    fallbackModel?: string;
    embeddingModel: string;
    storeResponses: boolean;
  };
  security?: {
    encryptionKey?: string;
    sessionTtlMs?: number;
  };
}

export interface WorkerTickResult {
  processed: boolean;
  jobId?: string;
  status?: "done" | "failed";
  detail?: string;
}

interface QueryExecutionResult {
  answer: QueryResponse["answer"];
  citations: QueryResponse["citations"];
  confidence: QueryResponse["confidence"];
  needsHuman: QueryResponse["needsHuman"];
  hits: QueryResponse["hits"];
  maxContextChunks: number;
}

export function createCoreServices(options: CoreServicesOptions) {
  const {
    db,
    pool,
    vectorStore,
    answerProvider,
    embeddingProvider,
    workspace,
    defaults,
    security,
  } = options;

  const sessionTtlMs = security?.sessionTtlMs ?? 1000 * 60 * 60 * 24 * 14;

  async function bootstrapWorkspace(): Promise<void> {
    await db
      .insert(workspaces)
      .values({
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
      })
      .onConflictDoUpdate({
        target: workspaces.id,
        set: {
          slug: workspace.slug,
          name: workspace.name,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(providerSettings)
      .values({
        id: createId("provider"),
        workspaceId: workspace.id,
        provider: "openai",
        config: {
          answerModel: defaults.answerModel,
          fallbackModel: defaults.fallbackModel,
          embeddingModel: defaults.embeddingModel,
        },
      })
      .onConflictDoNothing({
        target: [providerSettings.workspaceId, providerSettings.provider],
      });

    await db
      .insert(modelProfiles)
      .values({
        id: createId("model"),
        workspaceId: workspace.id,
        answerModel: defaults.answerModel,
        fallbackModel: defaults.fallbackModel,
        embeddingModel: defaults.embeddingModel,
        storeResponses: defaults.storeResponses,
        chunkSize: defaults.chunkSize,
        chunkOverlap: defaults.chunkOverlap,
        maxContextChunks: defaults.maxContextChunks,
      })
      .onConflictDoNothing({
        target: modelProfiles.workspaceId,
      });
  }

  async function hasUsers(): Promise<boolean> {
    const [result] = await db
      .select({ value: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.workspaceId, workspace.id));

    return Number(result?.value ?? 0) > 0;
  }

  async function bootstrapAdmin(input: AuthBootstrapInput): Promise<AuthSession> {
    if (await hasUsers()) {
      throw new Error("Bootstrap is only allowed before the first user exists.");
    }

    const userId = createId("user");
    const now = new Date();
    const token = createSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + sessionTtlMs);
    const email = input.email.trim().toLowerCase();
    const passwordHash = await hashPassword(input.password);

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        workspaceId: workspace.id,
        email,
        name: input.name.trim(),
        role: "admin",
        passwordHash,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(authSessions).values({
        id: createId("session"),
        workspaceId: workspace.id,
        userId,
        sessionTokenHash: tokenHash,
        expiresAt,
        lastSeenAt: now,
        createdAt: now,
      });
    });

    return {
      token,
      user: {
        id: userId,
        email,
        name: input.name.trim(),
        role: "admin",
      },
    };
  }

  async function login(input: AuthLoginInput): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.workspaceId, workspace.id), eq(users.email, email)),
      )
      .limit(1);

    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);

    if (!valid) {
      throw new Error("Invalid email or password.");
    }

    const token = createSessionToken();
    const now = new Date();
    await db.insert(authSessions).values({
      id: createId("session"),
      workspaceId: workspace.id,
      userId: user.id,
      sessionTokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + sessionTtlMs),
      lastSeenAt: now,
      createdAt: now,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async function getSession(token: string): Promise<AuthUser | null> {
    const tokenHash = hashToken(token);
    const [row] = await db
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        sessionId: authSessions.id,
        expiresAt: authSessions.expiresAt,
        revokedAt: authSessions.revokedAt,
      })
      .from(authSessions)
      .innerJoin(users, eq(users.id, authSessions.userId))
      .where(
        and(
          eq(authSessions.workspaceId, workspace.id),
          eq(authSessions.sessionTokenHash, tokenHash),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    if (row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    await db
      .update(authSessions)
      .set({
        lastSeenAt: new Date(),
      })
      .where(eq(authSessions.id, row.sessionId));

    return {
      id: row.userId,
      email: row.email,
      name: row.name,
      role: row.role,
    };
  }

  async function logout(token: string): Promise<void> {
    await db
      .update(authSessions)
      .set({
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(authSessions.workspaceId, workspace.id),
          eq(authSessions.sessionTokenHash, hashToken(token)),
        ),
      );
  }

  async function getSecret(scope: string): Promise<string | undefined> {
    const [secret] = await db
      .select()
      .from(encryptedSecrets)
      .where(
        and(
          eq(encryptedSecrets.workspaceId, workspace.id),
          eq(encryptedSecrets.scope, scope),
        ),
      )
      .limit(1);

    if (!secret) {
      return undefined;
    }

    return decryptSecret(
      {
        ciphertext: secret.ciphertext,
        iv: secret.iv,
        authTag: secret.authTag,
        keyVersion: secret.keyVersion,
      },
      security?.encryptionKey,
      workspace.id,
    );
  }

  function prepareSecret(plaintext: string | undefined) {
    if (!plaintext?.trim()) {
      return undefined;
    }

    return encryptSecret(plaintext.trim(), security?.encryptionKey, workspace.id);
  }

  async function getHealth(): Promise<HealthResponse> {
    const [dbHealth, vectorHealth, answerHealth, embeddingHealth] =
      await Promise.all([
        checkDatabaseHealth(pool),
        vectorStore.health(),
        answerProvider.health(),
        embeddingProvider.health(),
      ]);

    const ok =
      dbHealth.ok &&
      vectorHealth.ok &&
      answerHealth.ok &&
      embeddingHealth.ok;

    return {
      ok,
      services: {
        postgres: dbHealth,
        qdrant: vectorHealth,
        openaiAnswers: answerHealth,
        openaiEmbeddings: embeddingHealth,
      },
    };
  }

  async function listKnowledgeBases() {
    const bases = await db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.workspaceId, workspace.id),
          isNull(knowledgeBases.deletedAt),
        ),
      )
      .orderBy(desc(knowledgeBases.createdAt));

    const counts = await db
      .select({
        knowledgeBaseId: knowledgeEntries.knowledgeBaseId,
        entryCount: sql<number>`count(*)`,
      })
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.workspaceId, workspace.id),
          isNull(knowledgeEntries.deletedAt),
        ),
      )
      .groupBy(knowledgeEntries.knowledgeBaseId);

    const countsByKnowledgeBase = new Map(
      counts.map((row) => [row.knowledgeBaseId, Number(row.entryCount)]),
    );

    return bases.map((base) => ({
      ...base,
      entryCount: countsByKnowledgeBase.get(base.id) ?? 0,
    }));
  }

  async function createKnowledgeBase(input: KnowledgeBaseCreateInput) {
    const id = createId("kb");

    await db.insert(knowledgeBases).values({
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      slug: input.slug,
      description: input.description,
    });

    await writeAuditLog({
      action: "knowledge_base.created",
      targetType: "knowledge_base",
      targetId: id,
      metadata: input,
    });

    return {
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
    };
  }

  async function getKnowledgeBase(knowledgeBaseId: string) {
    const [knowledgeBase] = await db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, knowledgeBaseId),
          eq(knowledgeBases.workspaceId, workspace.id),
        ),
      )
      .limit(1);

    if (!knowledgeBase) {
      return null;
    }

    const [entryCountRow] = await db
      .select({
        entryCount: sql<number>`count(*)`,
      })
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.knowledgeBaseId, knowledgeBaseId),
          isNull(knowledgeEntries.deletedAt),
        ),
      );

    return {
      ...knowledgeBase,
      entryCount: Number(entryCountRow?.entryCount ?? 0),
    };
  }

  async function updateKnowledgeBase(
    knowledgeBaseId: string,
    input: KnowledgeBaseUpdateInput,
  ) {
    const [existing] = await db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, knowledgeBaseId),
          eq(knowledgeBases.workspaceId, workspace.id),
          isNull(knowledgeBases.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error(`Knowledge base ${knowledgeBaseId} was not found.`);
    }

    await db
      .update(knowledgeBases)
      .set({
        name: input.name ?? existing.name,
        slug: input.slug ?? existing.slug,
        description: input.description ?? existing.description,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBases.id, knowledgeBaseId));

    await writeAuditLog({
      action: "knowledge_base.updated",
      targetType: "knowledge_base",
      targetId: knowledgeBaseId,
      metadata: input,
    });

    return {
      ...existing,
      name: input.name ?? existing.name,
      slug: input.slug ?? existing.slug,
      description: input.description ?? existing.description,
    };
  }

  async function deleteKnowledgeBase(knowledgeBaseId: string) {
    const [existing] = await db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, knowledgeBaseId),
          eq(knowledgeBases.workspaceId, workspace.id),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error(`Knowledge base ${knowledgeBaseId} was not found.`);
    }

    const relatedEntries = await db
      .select()
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.knowledgeBaseId, knowledgeBaseId),
          isNull(knowledgeEntries.deletedAt),
        ),
      );

    await db.transaction(async (tx) => {
      await tx
        .update(knowledgeBases)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(knowledgeBases.id, knowledgeBaseId));

      if (relatedEntries.length > 0) {
        await tx
          .update(knowledgeEntries)
          .set({
            deletedAt: new Date(),
            status: "archived",
            updatedAt: new Date(),
          })
          .where(eq(knowledgeEntries.knowledgeBaseId, knowledgeBaseId));

        await tx.insert(indexJobs).values(
          relatedEntries.map((entry) => ({
            id: createId("job"),
            workspaceId: entry.workspaceId,
            knowledgeBaseId: entry.knowledgeBaseId,
            entryId: entry.id,
            versionId: entry.activeVersionId ?? undefined,
            jobType: "delete_item_vectors" as const,
            status: "queued" as const,
            payload: {
              source: "dashboard",
              reason: "knowledge_base_delete",
            },
          })),
        );
      }
    });

    await writeAuditLog({
      action: "knowledge_base.deleted",
      targetType: "knowledge_base",
      targetId: knowledgeBaseId,
      metadata: {
        softDeletedEntryCount: relatedEntries.length,
      },
    });

    return {
      knowledgeBaseId,
      softDeletedEntryCount: relatedEntries.length,
    };
  }

  async function listEntries(knowledgeBaseId?: string) {
    const conditions = [
      eq(knowledgeEntries.workspaceId, workspace.id),
      isNull(knowledgeEntries.deletedAt),
    ];

    if (knowledgeBaseId) {
      conditions.push(eq(knowledgeEntries.knowledgeBaseId, knowledgeBaseId));
    }

    const entries = await db
      .select()
      .from(knowledgeEntries)
      .where(and(...conditions))
      .orderBy(desc(knowledgeEntries.updatedAt));

    const versionCounts = await db
      .select({
        entryId: entryVersions.entryId,
        versionCount: sql<number>`count(*)`,
      })
      .from(entryVersions)
      .where(eq(entryVersions.workspaceId, workspace.id))
      .groupBy(entryVersions.entryId);

    const countsByEntry = new Map(
      versionCounts.map((row) => [row.entryId, Number(row.versionCount)]),
    );

    return entries.map((entry) => ({
      ...entry,
      versionCount: countsByEntry.get(entry.id) ?? 0,
    }));
  }

  async function lookupSources(citationIds: string[]): Promise<SourceLookupItem[]> {
    if (citationIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        chunkId: chunks.id,
        entryId: chunks.entryId,
        versionId: chunks.versionId,
        knowledgeBaseId: chunks.knowledgeBaseId,
        title: knowledgeEntries.title,
        content: chunks.content,
        ordinal: chunks.ordinal,
      })
      .from(chunks)
      .innerJoin(knowledgeEntries, eq(knowledgeEntries.id, chunks.entryId))
      .where(
        and(
          eq(chunks.workspaceId, workspace.id),
          inArray(chunks.id, citationIds),
        ),
      )
      .orderBy(chunks.ordinal);

    const byId = new Map(rows.map((row) => [row.chunkId, row]));

    return citationIds
      .map((citationId) => byId.get(citationId))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  async function getEntry(entryId: string) {
    const [entry] = await db
      .select()
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.id, entryId),
          eq(knowledgeEntries.workspaceId, workspace.id),
        ),
      );

    if (!entry) {
      return null;
    }

    const versions = await db
      .select()
      .from(entryVersions)
      .where(eq(entryVersions.entryId, entry.id))
      .orderBy(desc(entryVersions.versionNumber));

    return {
      ...entry,
      versions,
    };
  }

  async function createEntry(input: KnowledgeEntryCreateInput) {
    const knowledgeBase = await getKnowledgeBase(input.knowledgeBaseId);

    if (!knowledgeBase || knowledgeBase.deletedAt) {
      throw new Error(
        `Knowledge base ${input.knowledgeBaseId} is not available for new entries.`,
      );
    }

    const entryId = createId("entry");
    const versionId = createId("version");
    const jobId = createId("job");
    const checksum = checksumText(input.content);

    await db.transaction(async (tx) => {
      await tx.insert(knowledgeEntries).values({
        id: entryId,
        workspaceId: input.workspaceId,
        knowledgeBaseId: input.knowledgeBaseId,
        type: input.type,
        title: input.title,
        status: input.status,
        category: input.category,
        tags: input.tags,
        visibility: input.visibility,
      });

      await tx.insert(entryVersions).values({
        id: versionId,
        workspaceId: input.workspaceId,
        knowledgeBaseId: input.knowledgeBaseId,
        entryId,
        versionNumber: 1,
        sourceType: "text",
        title: input.title,
        content: input.content,
        checksum,
        status: "queued",
      });

      await tx.insert(indexJobs).values({
        id: jobId,
        workspaceId: input.workspaceId,
        knowledgeBaseId: input.knowledgeBaseId,
        entryId,
        versionId,
        jobType: "ingest_text",
        status: "queued",
        payload: { source: "dashboard" },
      });
    });

    await writeAuditLog({
      action: "knowledge_entry.created",
      targetType: "knowledge_entry",
      targetId: entryId,
      metadata: {
        entryId,
        versionId,
        knowledgeBaseId: input.knowledgeBaseId,
      },
    });

    return {
      entryId,
      versionId,
      jobId,
    };
  }

  async function updateEntry(
    entryId: string,
    input: KnowledgeEntryUpdateInput,
  ) {
    const [entry] = await db
      .select()
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.id, entryId),
          eq(knowledgeEntries.workspaceId, workspace.id),
          isNull(knowledgeEntries.deletedAt),
        ),
      );

    if (!entry) {
      throw new Error(`Knowledge entry ${entryId} was not found.`);
    }

    const [latestVersion] = await db
      .select()
      .from(entryVersions)
      .where(eq(entryVersions.entryId, entryId))
      .orderBy(desc(entryVersions.versionNumber))
      .limit(1);

    if (!latestVersion) {
      throw new Error(`Knowledge entry ${entryId} does not have a version yet.`);
    }

    const versionId = createId("version");
    const jobId = createId("job");
    const nextVersionNumber = latestVersion.versionNumber + 1;
    const title = input.title ?? latestVersion.title;
    const content = input.content ?? latestVersion.content;

    await db.transaction(async (tx) => {
      await tx
        .update(knowledgeEntries)
        .set({
          title,
          status: input.status ?? entry.status,
          category: input.category ?? entry.category,
          tags: input.tags ?? entry.tags,
          visibility: input.visibility ?? entry.visibility,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeEntries.id, entryId));

      await tx.insert(entryVersions).values({
        id: versionId,
        workspaceId: entry.workspaceId,
        knowledgeBaseId: entry.knowledgeBaseId,
        entryId,
        versionNumber: nextVersionNumber,
        sourceType: "text",
        title,
        content,
        checksum: checksumText(content),
        status: "queued",
      });

      await tx.insert(indexJobs).values({
        id: jobId,
        workspaceId: entry.workspaceId,
        knowledgeBaseId: entry.knowledgeBaseId,
        entryId,
        versionId,
        jobType: "ingest_text",
        status: "queued",
        payload: { source: "dashboard", reason: "update" },
      });
    });

    await writeAuditLog({
      action: "knowledge_entry.updated",
      targetType: "knowledge_entry",
      targetId: entryId,
      metadata: {
        entryId,
        versionId,
      },
    });

    return {
      entryId,
      versionId,
      jobId,
    };
  }

  async function deleteEntry(entryId: string) {
    const [entry] = await db
      .select()
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.id, entryId),
          eq(knowledgeEntries.workspaceId, workspace.id),
        ),
      );

    if (!entry) {
      throw new Error(`Knowledge entry ${entryId} was not found.`);
    }

    const jobId = createId("job");

    await db.transaction(async (tx) => {
      await tx
        .update(knowledgeEntries)
        .set({
          deletedAt: new Date(),
          status: "archived",
          updatedAt: new Date(),
        })
        .where(eq(knowledgeEntries.id, entryId));

      await tx.insert(indexJobs).values({
        id: jobId,
        workspaceId: entry.workspaceId,
        knowledgeBaseId: entry.knowledgeBaseId,
        entryId,
        versionId: entry.activeVersionId ?? undefined,
        jobType: "delete_item_vectors",
        status: "queued",
        payload: { source: "dashboard", reason: "soft_delete" },
      });
    });

    await writeAuditLog({
      action: "knowledge_entry.deleted",
      targetType: "knowledge_entry",
      targetId: entryId,
      metadata: { jobId },
    });

    return { entryId, jobId };
  }

  async function reindexEntry(entryId: string) {
    const [entry] = await db
      .select()
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.id, entryId),
          eq(knowledgeEntries.workspaceId, workspace.id),
          isNull(knowledgeEntries.deletedAt),
        ),
      );

    if (!entry) {
      throw new Error(`Knowledge entry ${entryId} was not found.`);
    }

    const [version] = await db
      .select()
      .from(entryVersions)
      .where(eq(entryVersions.entryId, entryId))
      .orderBy(desc(entryVersions.versionNumber))
      .limit(1);

    if (!version) {
      throw new Error(`Knowledge entry ${entryId} does not have a version yet.`);
    }

    const jobId = createId("job");

    await db.insert(indexJobs).values({
      id: jobId,
      workspaceId: entry.workspaceId,
      knowledgeBaseId: entry.knowledgeBaseId,
      entryId,
      versionId: version.id,
      jobType: "reindex_item",
      status: "queued",
      payload: { source: "dashboard", reason: "manual_reindex" },
    });

    await writeAuditLog({
      action: "knowledge_entry.reindexed",
      targetType: "knowledge_entry",
      targetId: entryId,
      metadata: { jobId, versionId: version.id },
    });

    return { jobId, versionId: version.id };
  }

  async function getProviderSettings() {
    const [providerRow] = await db
      .select()
      .from(providerSettings)
      .where(
        and(
          eq(providerSettings.workspaceId, workspace.id),
          eq(providerSettings.provider, "openai"),
        ),
        )
      .limit(1);

    const modelRow = await getActiveModelProfile();
    const [storedSecret] = await db
      .select({ id: encryptedSecrets.id })
      .from(encryptedSecrets)
      .where(
        and(
          eq(encryptedSecrets.workspaceId, workspace.id),
          eq(encryptedSecrets.scope, "openai_api_key"),
        ),
      )
      .limit(1);

    return {
      provider: "openai",
      answerModel: modelRow?.answerModel ?? defaults.answerModel,
      fallbackModel:
        modelRow?.fallbackModel ?? defaults.fallbackModel ?? undefined,
      embeddingModel: modelRow?.embeddingModel ?? defaults.embeddingModel,
      storeResponses: modelRow?.storeResponses ?? defaults.storeResponses,
      chunkSize: modelRow?.chunkSize ?? defaults.chunkSize,
      chunkOverlap: modelRow?.chunkOverlap ?? defaults.chunkOverlap,
      maxContextChunks: modelRow?.maxContextChunks ?? defaults.maxContextChunks,
      secretRef:
        typeof providerRow?.secretRef === "string" ? providerRow.secretRef : undefined,
      hasStoredSecret: Boolean(storedSecret),
    };
  }

  async function updateProviderSettings(
    input: ProviderSettingsInput,
  ) {
    const now = new Date();
    const encryptedSecret = prepareSecret(input.apiKey);

    await db.transaction(async (tx) => {
      await tx
        .insert(providerSettings)
        .values({
          id: createId("provider"),
          workspaceId: workspace.id,
          provider: input.provider,
          secretRef: input.secretRef,
          config: {
            answerModel: input.answerModel,
            fallbackModel: input.fallbackModel,
            embeddingModel: input.embeddingModel,
          },
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [providerSettings.workspaceId, providerSettings.provider],
          set: {
            secretRef: input.secretRef,
            config: {
              answerModel: input.answerModel,
              fallbackModel: input.fallbackModel,
              embeddingModel: input.embeddingModel,
            },
            updatedAt: now,
          },
        });

      await tx
        .insert(modelProfiles)
        .values({
          id: createId("model"),
          workspaceId: workspace.id,
          answerModel: input.answerModel,
          fallbackModel: input.fallbackModel,
          embeddingModel: input.embeddingModel,
          storeResponses: input.storeResponses,
          chunkSize: input.chunkSize,
          chunkOverlap: input.chunkOverlap,
          maxContextChunks: input.maxContextChunks,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: modelProfiles.workspaceId,
          set: {
            answerModel: input.answerModel,
            fallbackModel: input.fallbackModel,
            embeddingModel: input.embeddingModel,
            storeResponses: input.storeResponses,
            chunkSize: input.chunkSize,
            chunkOverlap: input.chunkOverlap,
            maxContextChunks: input.maxContextChunks,
            updatedAt: now,
          },
        });

      if (encryptedSecret) {
        await tx
          .insert(encryptedSecrets)
          .values({
            id: createId("secret"),
            workspaceId: workspace.id,
            scope: "openai_api_key",
            ciphertext: encryptedSecret.ciphertext,
            iv: encryptedSecret.iv,
            authTag: encryptedSecret.authTag,
            keyVersion: encryptedSecret.keyVersion,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [encryptedSecrets.workspaceId, encryptedSecrets.scope],
            set: {
              ciphertext: encryptedSecret.ciphertext,
              iv: encryptedSecret.iv,
              authTag: encryptedSecret.authTag,
              keyVersion: encryptedSecret.keyVersion,
              updatedAt: now,
            },
          });
      }
    });

    await writeAuditLog({
      action: "provider_settings.updated",
      targetType: "provider_settings",
      targetId: workspace.id,
      metadata: {
        provider: input.provider,
        answerModel: input.answerModel,
        fallbackModel: input.fallbackModel,
        embeddingModel: input.embeddingModel,
        storeResponses: input.storeResponses,
        chunkSize: input.chunkSize,
        chunkOverlap: input.chunkOverlap,
        maxContextChunks: input.maxContextChunks,
        secretRef: input.secretRef,
        hasApiKeyInput: Boolean(input.apiKey),
      },
    });

    return getProviderSettings();
  }

  async function getDiscordSettings() {
    const [guild] = await db
      .select()
      .from(discordGuilds)
      .where(eq(discordGuilds.workspaceId, workspace.id))
      .limit(1);
    const [storedSecret] = await db
      .select({ id: encryptedSecrets.id })
      .from(encryptedSecrets)
      .where(
        and(
          eq(encryptedSecrets.workspaceId, workspace.id),
          eq(encryptedSecrets.scope, "discord_bot_token"),
        ),
      )
      .limit(1);

    const settings = (guild?.settings ?? {}) as Record<string, unknown>;

    return {
      clientId:
        typeof settings.clientId === "string" ? settings.clientId : undefined,
      guildId: guild?.id,
      mentionOnly:
        typeof settings.mentionOnly === "boolean" ? settings.mentionOnly : true,
      allowedChannelIds: Array.isArray(settings.allowedChannelIds)
        ? settings.allowedChannelIds.map(String)
        : [],
      handoffMessage:
        typeof settings.handoffMessage === "string"
          ? settings.handoffMessage
          : "A human teammate will follow up soon.",
      hasStoredBotToken: Boolean(storedSecret),
    };
  }

  async function updateDiscordSettings(input: DiscordSettingsInput) {
    const guildId = input.guildId ?? "discord_default";
    const now = new Date();
    const encryptedBotToken = prepareSecret(input.botToken);

    await db.transaction(async (tx) => {
      await tx
        .insert(discordGuilds)
        .values({
          id: guildId,
          workspaceId: workspace.id,
          name: input.guildId ?? "Primary guild",
          settings: {
            clientId: input.clientId,
            mentionOnly: input.mentionOnly,
            allowedChannelIds: input.allowedChannelIds,
            handoffMessage: input.handoffMessage,
          },
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: discordGuilds.id,
          set: {
            settings: {
              clientId: input.clientId,
              mentionOnly: input.mentionOnly,
              allowedChannelIds: input.allowedChannelIds,
              handoffMessage: input.handoffMessage,
            },
            updatedAt: now,
          },
        });

      if (encryptedBotToken) {
        await tx
          .insert(encryptedSecrets)
          .values({
            id: createId("secret"),
            workspaceId: workspace.id,
            scope: "discord_bot_token",
            ciphertext: encryptedBotToken.ciphertext,
            iv: encryptedBotToken.iv,
            authTag: encryptedBotToken.authTag,
            keyVersion: encryptedBotToken.keyVersion,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [encryptedSecrets.workspaceId, encryptedSecrets.scope],
            set: {
              ciphertext: encryptedBotToken.ciphertext,
              iv: encryptedBotToken.iv,
              authTag: encryptedBotToken.authTag,
              keyVersion: encryptedBotToken.keyVersion,
              updatedAt: now,
            },
          });
      }
    });

    await writeAuditLog({
      action: "discord_settings.updated",
      targetType: "discord_settings",
      targetId: guildId,
      metadata: {
        clientId: input.clientId,
        guildId: input.guildId,
        mentionOnly: input.mentionOnly,
        allowedChannelIds: input.allowedChannelIds,
        handoffMessage: input.handoffMessage,
        hasBotTokenInput: Boolean(input.botToken),
      },
    });

    return getDiscordSettings();
  }

  async function listJobs() {
    return db
      .select()
      .from(indexJobs)
      .where(eq(indexJobs.workspaceId, workspace.id))
      .orderBy(desc(indexJobs.createdAt))
      .limit(100);
  }

  async function getDashboardSummary() {
    const [
      knowledgeBaseRow,
      entryRow,
      jobRow,
      queryRow,
      failedJobRow,
    ] = await Promise.all([
      db
        .select({ value: sql<number>`count(*)` })
        .from(knowledgeBases)
        .where(
          and(
            eq(knowledgeBases.workspaceId, workspace.id),
            isNull(knowledgeBases.deletedAt),
          ),
        ),
      db
        .select({ value: sql<number>`count(*)` })
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.workspaceId, workspace.id),
            isNull(knowledgeEntries.deletedAt),
          ),
        ),
      db
        .select({ value: sql<number>`count(*)` })
        .from(indexJobs)
        .where(
          and(
            eq(indexJobs.workspaceId, workspace.id),
            eq(indexJobs.status, "queued"),
          ),
        ),
      db
        .select({ value: sql<number>`count(*)` })
        .from(queryLogs)
        .where(eq(queryLogs.workspaceId, workspace.id)),
      db
        .select({ value: sql<number>`count(*)` })
        .from(indexJobs)
        .where(
          and(
            eq(indexJobs.workspaceId, workspace.id),
            eq(indexJobs.status, "failed"),
          ),
        ),
    ]);

    return {
      knowledgeBaseCount: Number(knowledgeBaseRow[0]?.value ?? 0),
      entryCount: Number(entryRow[0]?.value ?? 0),
      queuedJobCount: Number(jobRow[0]?.value ?? 0),
      queryCount: Number(queryRow[0]?.value ?? 0),
      failedJobCount: Number(failedJobRow[0]?.value ?? 0),
    };
  }

  async function listQueryLogs() {
    return db
      .select()
      .from(queryLogs)
      .where(eq(queryLogs.workspaceId, workspace.id))
      .orderBy(desc(queryLogs.createdAt))
      .limit(100);
  }

  async function getAnalytics() {
    const [totals] = await db
      .select({
        queryCount: sql<number>`count(*)`,
        handoffCount:
          sql<number>`coalesce(sum(case when ${queryLogs.needsHuman} then 1 else 0 end), 0)`,
      })
      .from(queryLogs)
      .where(eq(queryLogs.workspaceId, workspace.id));

    return {
      queryCount: Number(totals?.queryCount ?? 0),
      handoffCount: Number(totals?.handoffCount ?? 0),
      handoffRate:
        Number(totals?.queryCount ?? 0) === 0
          ? 0
          : Number(totals?.handoffCount ?? 0) / Number(totals?.queryCount ?? 1),
    };
  }

  async function retryJob(jobId: string) {
    const [job] = await db
      .select()
      .from(indexJobs)
      .where(
        and(eq(indexJobs.id, jobId), eq(indexJobs.workspaceId, workspace.id)),
      )
      .limit(1);

    if (!job) {
      throw new Error(`Job ${jobId} was not found.`);
    }

    await db
      .update(indexJobs)
      .set({
        status: "queued",
        error: null,
        lockedBy: null,
        availableAt: new Date(),
        startedAt: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(indexJobs.id, jobId));

    return { jobId };
  }

  async function query(input: QueryRequest): Promise<QueryResponse> {
    const execution = await executeQueryPipeline(input);

    await db.insert(queryLogs).values({
      id: createId("query"),
      workspaceId: input.workspaceId,
      guildId: input.guildId,
      channelId: input.channelId,
      userId: input.userId,
      question: input.question,
      normalizedQuestion: normalizeQuestion(input.question),
      answer: execution.answer,
      citations: execution.citations,
      confidence: execution.confidence,
      needsHuman: execution.needsHuman,
    });

    return execution;
  }

  async function preview(input: QueryRequest): Promise<QueryPreviewResponse> {
    const response = await executeQueryPipeline(input);
    const prompt = buildAnswerPrompt({
      question: input.question,
      context: response.hits.slice(0, response.maxContextChunks),
    });

    return {
      prompt,
      answer: {
        answer: response.answer,
        citations: response.citations,
        confidence: response.confidence,
        needsHuman: response.needsHuman,
      },
      hits: response.hits,
    };
  }

  async function executeQueryPipeline(
    input: QueryRequest,
  ): Promise<QueryExecutionResult> {
    const profile = await getActiveModelProfile();
    const maxContextChunks =
      profile?.maxContextChunks ?? defaults.maxContextChunks;
    const embedding = await embeddingProvider.embed([input.question], {
      model: profile?.embeddingModel ?? defaults.embeddingModel,
    });
    const hits = await vectorStore.query({
      workspaceId: input.workspaceId,
      knowledgeBaseIds: input.knowledgeBaseIds,
      vector: embedding[0] ?? [],
      topK: Math.max(maxContextChunks * 2, 6),
      filter: {
        status: "published",
      },
    });
    const answer = await answerProvider.answer({
      question: input.question,
      context: hits.slice(0, maxContextChunks),
      answerModel: profile?.answerModel ?? defaults.answerModel,
      fallbackModel: profile?.fallbackModel ?? defaults.fallbackModel,
    });

    return {
      ...answer,
      hits,
      maxContextChunks,
    };
  }

  async function runWorkerTick(workerId: string): Promise<WorkerTickResult> {
    const claimed = (await db.execute(sql`
      with next_job as (
        select id
        from ${indexJobs}
        where ${indexJobs.workspaceId} = ${workspace.id}
          and ${indexJobs.status} = 'queued'
          and ${indexJobs.availableAt} <= now()
        order by ${indexJobs.createdAt}
        for update skip locked
        limit 1
      )
      update ${indexJobs}
      set
        "status" = 'processing',
        "locked_by" = ${workerId},
        "attempts" = "attempts" + 1,
        "started_at" = now(),
        "updated_at" = now()
      where ${indexJobs.id} in (select id from next_job)
      returning *;
    `)) as {
      rows: Array<{
        id: string;
        entry_id: string | null;
        knowledge_base_id: string | null;
        version_id: string | null;
        job_type:
          | "ingest_text"
          | "ingest_file"
          | "reindex_item"
          | "reindex_kb"
          | "delete_item_vectors"
          | "full_reembed";
      }>;
    };

    const job = claimed.rows[0];

    if (!job) {
      return { processed: false };
    }

    try {
      switch (job.job_type) {
        case "ingest_text":
        case "ingest_file":
        case "reindex_item":
        case "full_reembed":
          await processVersionJob(job.version_id, job.entry_id);
          break;
        case "delete_item_vectors":
          await processDeleteJob(
            job.knowledge_base_id ?? undefined,
            job.entry_id ?? undefined,
            job.version_id ?? undefined,
          );
          break;
        case "reindex_kb":
          await processKnowledgeBaseReindex(job.knowledge_base_id);
          break;
        default:
          throw new Error(`Unsupported job type ${job.job_type}.`);
      }

      await db
        .update(indexJobs)
        .set({
          status: "done",
          completedAt: new Date(),
          updatedAt: new Date(),
          error: null,
        })
        .where(eq(indexJobs.id, job.id));

      return {
        processed: true,
        jobId: job.id,
        status: "done",
      };
    } catch (error) {
      await db
        .update(indexJobs)
        .set({
          status: "failed",
          updatedAt: new Date(),
          error: error instanceof Error ? error.message : "Unknown worker error",
        })
        .where(eq(indexJobs.id, job.id));

      if (job.version_id) {
        await db
          .update(entryVersions)
          .set({
            status: "failed",
          })
          .where(eq(entryVersions.id, job.version_id));
      }

      return {
        processed: true,
        jobId: job.id,
        status: "failed",
        detail: error instanceof Error ? error.message : "Unknown worker error",
      };
    }
  }

  async function processVersionJob(
    versionId: string | null,
    entryId: string | null,
  ): Promise<void> {
    if (!versionId || !entryId) {
      throw new Error("Version-backed jobs require both versionId and entryId.");
    }

    const [version] = await db
      .select()
      .from(entryVersions)
      .where(eq(entryVersions.id, versionId))
      .limit(1);

    const [entry] = await db
      .select()
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.id, entryId))
      .limit(1);

    if (!version || !entry) {
      throw new Error(`Missing version data for ${versionId}.`);
    }

    await db
      .update(entryVersions)
      .set({
        status: "processing",
      })
      .where(eq(entryVersions.id, version.id));

    const profile = await getActiveModelProfile();
    const pieces = chunkText(
      version.content,
      profile?.chunkSize ?? defaults.chunkSize,
      profile?.chunkOverlap ?? defaults.chunkOverlap,
    );
    const embeddings = await embeddingProvider.embed(
      pieces.map((piece) => piece.content),
      {
        model: profile?.embeddingModel ?? defaults.embeddingModel,
      },
    );

    const embeddedChunks: EmbeddedChunk[] = pieces.map((piece, index) => ({
      chunkId: randomUUID(),
      workspaceId: version.workspaceId,
      knowledgeBaseId: version.knowledgeBaseId,
      entryId: version.entryId,
      versionId: version.id,
      content: piece.content,
      ordinal: index,
      tokenCount: piece.tokenCount,
      embedding: embeddings[index] ?? embeddings[0] ?? [],
      payload: {
        category: entry.category,
        tags: entry.tags,
        visibility: entry.visibility,
        status: entry.status,
      },
    }));

    await vectorStore.deleteByItemVersion({
      workspaceId: version.workspaceId,
      knowledgeBaseId: version.knowledgeBaseId,
      entryId: version.entryId,
      versionId: version.id,
    });

    await db.delete(chunks).where(eq(chunks.versionId, version.id));

    if (embeddedChunks.length > 0) {
      await db.insert(chunks).values(
        embeddedChunks.map((chunk) => ({
          id: chunk.chunkId,
          workspaceId: chunk.workspaceId,
          knowledgeBaseId: chunk.knowledgeBaseId,
          entryId: chunk.entryId,
          versionId: chunk.versionId,
          ordinal: chunk.ordinal,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          payload: chunk.payload,
        })),
      );

      await vectorStore.upsertChunks(embeddedChunks);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(entryVersions)
        .set({
          status: "ready",
          indexedAt: new Date(),
        })
        .where(eq(entryVersions.id, version.id));

      await tx
        .update(knowledgeEntries)
        .set({
          activeVersionId: version.id,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeEntries.id, entry.id));
    });
  }

  async function processDeleteJob(
    knowledgeBaseId?: string,
    entryId?: string,
    versionId?: string,
  ): Promise<void> {
    await vectorStore.deleteByItemVersion({
      workspaceId: workspace.id,
      ...(knowledgeBaseId ? { knowledgeBaseId } : {}),
      ...(entryId ? { entryId } : {}),
      ...(versionId ? { versionId } : {}),
    });

    if (versionId) {
      await db.delete(chunks).where(eq(chunks.versionId, versionId));
      return;
    }

    if (entryId) {
      await db.delete(chunks).where(eq(chunks.entryId, entryId));
    }
  }

  async function processKnowledgeBaseReindex(
    knowledgeBaseId: string | null,
  ): Promise<void> {
    if (!knowledgeBaseId) {
      throw new Error("Reindex KB jobs require a knowledge base id.");
    }

    const versions = await db
      .select({
        versionId: entryVersions.id,
        entryId: entryVersions.entryId,
      })
      .from(entryVersions)
      .where(eq(entryVersions.knowledgeBaseId, knowledgeBaseId));

    for (const version of versions) {
      await processVersionJob(version.versionId, version.entryId);
    }
  }

  async function writeAuditLog(input: {
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }) {
    await db.insert(auditLogs).values({
      id: createId("audit"),
      workspaceId: workspace.id,
      actorId: "system",
      actorType: "system",
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? {},
    });
  }

  async function getActiveModelProfile() {
    const [profile] = await db
      .select()
      .from(modelProfiles)
      .where(eq(modelProfiles.workspaceId, workspace.id))
      .limit(1);

    return profile ?? null;
  }

  async function getOpenAiApiKey(): Promise<string | undefined> {
    return getSecret("openai_api_key");
  }

  async function getDiscordBotToken(): Promise<string | undefined> {
    return getSecret("discord_bot_token");
  }

  return {
    bootstrapWorkspace,
    hasUsers,
    bootstrapAdmin,
    login,
    getSession,
    logout,
    getHealth,
    getOpenAiApiKey,
    getDiscordBotToken,
    getKnowledgeBase,
    listKnowledgeBases,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    listEntries,
    getEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    reindexEntry,
    lookupSources,
    getProviderSettings,
    updateProviderSettings,
    getDiscordSettings,
    updateDiscordSettings,
    listJobs,
    getDashboardSummary,
    listQueryLogs,
    getAnalytics,
    retryJob,
    query,
    preview,
    runWorkerTick,
  };
}

function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}

function checksumText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function chunkText(
  value: string,
  chunkSize: number,
  overlap: number,
): Array<{ content: string; tokenCount: number }> {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const pieces: Array<{ content: string; tokenCount: number }> = [];
  const safeChunkSize = Math.max(chunkSize, 50);
  const safeOverlap = Math.min(Math.max(overlap, 0), safeChunkSize - 1);

  for (let start = 0; start < words.length; start += safeChunkSize - safeOverlap) {
    const slice = words.slice(start, start + safeChunkSize);

    if (slice.length === 0) {
      continue;
    }

    pieces.push({
      content: slice.join(" "),
      tokenCount: slice.length,
    });

    if (start + safeChunkSize >= words.length) {
      break;
    }
  }

  return pieces;
}
