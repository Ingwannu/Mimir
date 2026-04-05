import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "wickedhostbotai_session";
const apiBaseUrl = process.env.WEB_API_BASE_URL ?? "http://localhost:4000";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin";
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  const response = await fetch(`${apiBaseUrl}/v1/auth/session`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { user: SessionUser };
  return payload.user;
}

export async function hasValidSession(): Promise<boolean> {
  return Boolean(await getCurrentUser());
}

export async function needsBootstrap(): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/bootstrap-status`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { needsBootstrap: boolean };
  return payload.needsBootstrap;
}

export async function getAdminProxyHeaders(): Promise<Headers> {
  const headers = new Headers();
  const token = await getSessionToken();

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return headers;
}
