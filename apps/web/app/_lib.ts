export interface HealthSnapshot {
  ok: boolean;
  source: string;
  services: Record<string, { ok: boolean; detail?: string }>;
}

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const baseUrl = process.env.WEB_API_BASE_URL ?? "http://localhost:4000";

  try {
    const response = await fetch(`${baseUrl}/v1/health`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Health endpoint returned ${response.status}.`);
    }

    const payload = (await response.json()) as {
      ok: boolean;
      services: Record<string, { ok: boolean; detail?: string }>;
    };

    return {
      ok: payload.ok,
      services: payload.services,
      source: baseUrl,
    };
  } catch (error) {
    return {
      ok: false,
      source: baseUrl,
      services: {
        api: {
          ok: false,
          detail:
            error instanceof Error
              ? error.message
              : "API health request failed.",
        },
      },
    };
  }
}
