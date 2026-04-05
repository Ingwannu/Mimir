import assert from "node:assert/strict";

const baseUrl = process.env.STACK_BASE_URL ?? "http://127.0.0.1:4000";
const workspaceId = process.env.WORKSPACE_ID ?? "workspace_demo";
const adminToken = process.env.ADMIN_TOKEN ?? "change-me-before-production";

async function main(): Promise<void> {
  const health = await requestJson(`${baseUrl}/v1/health`);
  assert.equal(health.ok, true, "API health should be ok");

  const knowledgeBase = await requestJson(`${baseUrl}/v1/admin/kbs`, {
    method: "POST",
    body: {
      workspaceId,
      name: `Smoke ${Date.now()}`,
      slug: `smoke-${Date.now()}`,
    },
  });

  const entry = await requestJson(`${baseUrl}/v1/admin/entries`, {
    method: "POST",
    body: {
      workspaceId,
      knowledgeBaseId: knowledgeBase.id,
      type: "article",
      title: "Smoke article",
      content:
        "Refunds are available within 7 days of purchase. Customers should open a billing ticket to request a refund.",
      category: "billing",
      tags: ["refund", "smoke"],
      visibility: "guild",
      status: "published",
    },
  });

  let lastJob: Record<string, unknown> | undefined;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const jobs = (await requestJson(`${baseUrl}/v1/admin/jobs`)) as Array<
      Record<string, unknown>
    >;
    lastJob = jobs.find((job) => job.id === entry.jobId);

    if (lastJob?.status === "done") {
      break;
    }

    if (lastJob?.status === "failed") {
      throw new Error(`Index job failed: ${String(lastJob.error ?? "unknown")}`);
    }

    await sleep(1000);
  }

  assert.equal(lastJob?.status, "done", "Index job should complete");

  const query = await requestJson(`${baseUrl}/v1/query`, {
    method: "POST",
    body: {
      workspaceId,
      knowledgeBaseIds: [knowledgeBase.id],
      question: "How long do I have to ask for a refund?",
    },
  });

  assert.ok(
    String(query.answer).includes("7 days"),
    "Query answer should mention the refund window",
  );
  assert.ok(
    Array.isArray(query.citations) && query.citations.length > 0,
    "Query should return citations",
  );

  const sourceLookup = await requestJson(`${baseUrl}/v1/query/sources`, {
    method: "POST",
    body: {
      workspaceId,
      citationIds: query.citations,
    },
  });

  assert.ok(
    Array.isArray(sourceLookup) && sourceLookup.length > 0,
    "Source lookup should return cited chunks",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        knowledgeBaseId: knowledgeBase.id,
        entryId: entry.entryId,
        jobId: entry.jobId,
        answer: query.answer,
        citations: query.citations,
        firstSourceChunkId: sourceLookup[0]?.chunkId ?? null,
      },
      null,
      2,
    ),
  );
}

async function requestJson(
  url: string,
  input?: {
    method?: string;
    body?: Record<string, unknown>;
  },
): Promise<any> {
  const response = await fetch(url, {
    method: input?.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(adminToken ? { "x-admin-token": adminToken } : {}),
    },
    body: input?.body ? JSON.stringify(input.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }

  return response.json();
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
