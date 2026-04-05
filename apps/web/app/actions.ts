"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  getCurrentUser,
  getSessionToken,
} from "./auth";
import {
  buildHeaders,
  parseChannelInput,
  parseTagInput,
} from "./lib";

const apiBaseUrl = process.env.WEB_API_BASE_URL ?? "http://localhost:4000";
const workspaceId = process.env.WORKSPACE_ID ?? "workspace_demo";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/").trim() || "/";

  const response = await fetch(`${apiBaseUrl}/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(nextPath)}`);
  }

  const payload = (await response.json()) as { token: string };
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, payload.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  redirect(nextPath);
}

export async function bootstrapAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const response = await fetch(`${apiBaseUrl}/v1/auth/bootstrap`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    redirect("/login?error=bootstrap");
  }

  const payload = (await response.json()) as { token: string };
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, payload.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  redirect("/");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (token) {
    await fetch(`${apiBaseUrl}/v1/auth/logout`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  }

  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/login");
}

export async function createKnowledgeBaseAction(formData: FormData) {
  await apiPost("/v1/admin/kbs", {
    workspaceId,
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    description: emptyToUndefined(formData.get("description")),
  });

  revalidatePath("/");
  revalidatePath("/setup");
  revalidatePath("/knowledge");
  redirect("/knowledge");
}

export async function updateKnowledgeBaseAction(formData: FormData) {
  const knowledgeBaseId = String(formData.get("knowledgeBaseId") ?? "");

  await apiPatch(`/v1/admin/kbs/${knowledgeBaseId}`, {
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    description: emptyToUndefined(formData.get("description")),
  });

  revalidatePath("/knowledge");
  redirect(`/knowledge?kbId=${encodeURIComponent(knowledgeBaseId)}`);
}

export async function deleteKnowledgeBaseAction(formData: FormData) {
  const knowledgeBaseId = String(formData.get("knowledgeBaseId") ?? "");

  await apiDelete(`/v1/admin/kbs/${knowledgeBaseId}`);

  revalidatePath("/");
  revalidatePath("/knowledge");
  redirect("/knowledge");
}

export async function createEntryAction(formData: FormData) {
  const knowledgeBaseId = String(formData.get("knowledgeBaseId") ?? "");

  await apiPost("/v1/admin/entries", {
    workspaceId,
    knowledgeBaseId,
    type: String(formData.get("type") ?? "article"),
    title: String(formData.get("title") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
    category: emptyToUndefined(formData.get("category")),
    tags: parseTagInput(String(formData.get("tags") ?? "")),
    visibility: String(formData.get("visibility") ?? "guild"),
    status: String(formData.get("status") ?? "published"),
  });

  revalidatePath("/");
  revalidatePath("/knowledge");
  revalidatePath("/jobs");
  redirect(`/knowledge?kbId=${encodeURIComponent(knowledgeBaseId)}`);
}

export async function updateEntryAction(formData: FormData) {
  const entryId = String(formData.get("entryId") ?? "");
  const knowledgeBaseId = String(formData.get("knowledgeBaseId") ?? "");

  await apiPatch(`/v1/admin/entries/${entryId}`, {
    title: String(formData.get("title") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
    category: emptyToUndefined(formData.get("category")),
    tags: parseTagInput(String(formData.get("tags") ?? "")),
    visibility: String(formData.get("visibility") ?? "guild"),
    status: String(formData.get("status") ?? "published"),
  });

  revalidatePath("/knowledge");
  revalidatePath("/jobs");
  redirect(
    `/knowledge?kbId=${encodeURIComponent(knowledgeBaseId)}&entryId=${encodeURIComponent(entryId)}`,
  );
}

export async function deleteEntryAction(formData: FormData) {
  const entryId = String(formData.get("entryId") ?? "");
  const knowledgeBaseId = String(formData.get("knowledgeBaseId") ?? "");

  await apiDelete(`/v1/admin/entries/${entryId}`);

  revalidatePath("/");
  revalidatePath("/knowledge");
  revalidatePath("/jobs");
  redirect(`/knowledge?kbId=${encodeURIComponent(knowledgeBaseId)}`);
}

export async function reindexEntryAction(formData: FormData) {
  const entryId = String(formData.get("entryId") ?? "");
  const knowledgeBaseId = String(formData.get("knowledgeBaseId") ?? "");

  await apiPost(`/v1/admin/entries/${entryId}/reindex`, {});

  revalidatePath("/knowledge");
  revalidatePath("/jobs");
  redirect(
    `/knowledge?kbId=${encodeURIComponent(knowledgeBaseId)}&entryId=${encodeURIComponent(entryId)}`,
  );
}

export async function retryJobAction(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");

  await apiPost(`/v1/admin/jobs/${jobId}/retry`, {});

  revalidatePath("/jobs");
  redirect("/jobs");
}

export async function updateProviderSettingsAction(formData: FormData) {
  await apiPut("/v1/admin/settings/provider", {
    provider: "openai",
    answerModel: String(formData.get("answerModel") ?? "").trim(),
    fallbackModel: emptyToUndefined(formData.get("fallbackModel")),
    embeddingModel: String(formData.get("embeddingModel") ?? "").trim(),
    storeResponses: formData.get("storeResponses") === "on",
    chunkSize: Number(formData.get("chunkSize") ?? 700),
    chunkOverlap: Number(formData.get("chunkOverlap") ?? 120),
    maxContextChunks: Number(formData.get("maxContextChunks") ?? 4),
    secretRef: emptyToUndefined(formData.get("secretRef")),
    apiKey: emptyToUndefined(formData.get("apiKey")),
  });

  revalidatePath("/");
  revalidatePath("/setup");
  revalidatePath("/settings");
  redirect("/settings");
}

export async function updateDiscordSettingsAction(formData: FormData) {
  await apiPut("/v1/admin/settings/discord", {
    clientId: emptyToUndefined(formData.get("clientId")),
    guildId: emptyToUndefined(formData.get("guildId")),
    mentionOnly: formData.get("mentionOnly") === "on",
    allowedChannelIds: parseChannelInput(
      String(formData.get("allowedChannelIds") ?? ""),
    ),
    handoffMessage: String(formData.get("handoffMessage") ?? "").trim(),
    botToken: emptyToUndefined(formData.get("botToken")),
  });

  revalidatePath("/setup");
  revalidatePath("/settings");
  redirect("/settings");
}

async function apiPost(path: string, body: Record<string, unknown>) {
  await apiRequest(path, "POST", body);
}

async function apiPut(path: string, body: Record<string, unknown>) {
  await apiRequest(path, "PUT", body);
}

async function apiPatch(path: string, body: Record<string, unknown>) {
  await apiRequest(path, "PATCH", body);
}

async function apiDelete(path: string) {
  await apiRequest(path, "DELETE");
}

async function apiRequest(
  path: string,
  method: string,
  body?: Record<string, unknown>,
) {
  await requireAuthenticated();

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: await buildHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `${method} ${path} failed`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Keep default message when the response is not JSON.
    }

    throw new Error(message);
  }
}

function emptyToUndefined(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

async function requireAuthenticated() {
  const token = await getSessionToken();
  const user = await getCurrentUser();

  if (!token || !user) {
    redirect("/login");
  }
}
