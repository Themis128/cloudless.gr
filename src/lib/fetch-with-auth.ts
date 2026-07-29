"use client";

/**
 * Fetch wrapper that authenticates admin/API calls.
 *
 * Cognito (`NEXT_PUBLIC_AUTH_PROVIDER=cognito`): attaches next-auth ID token
 * as Bearer (defense-in-depth alongside the session cookie).
 *
 * D1 (default): relies on the HttpOnly `session_token` cookie — same-origin
 * fetch sends cookies; do not attach leftover Cognito JWTs.
 *
 * Cognito session cache: short TTL so admin layout parallel fan-out doesn't
 * hammer /api/auth/session. Cleared on 401.
 */

import { getSession } from "next-auth/react";

const CACHE_TTL_MS =
  process.env.VITEST === "true" || process.env.NODE_ENV === "test" ? 0 : 5000;

/** Read at call time so Vitest can toggle NEXT_PUBLIC_AUTH_PROVIDER per test. */
function cognitoBearerEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_PROVIDER === "cognito";
}

let cachedSession: {
  value: Awaited<ReturnType<typeof getSession>>;
  at: number;
} | null = null;

async function getCachedSession() {
  const now = Date.now();
  if (cachedSession && now - cachedSession.at < CACHE_TTL_MS) {
    return cachedSession.value;
  }
  const value = await getSession();
  cachedSession = { value, at: now };
  return value;
}

/** Invalidate the session cache. Call after sign-in / sign-out or on 401. */
export function clearSessionCache(): void {
  cachedSession = null;
}

export async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) || {}),
  };

  if (cognitoBearerEnabled()) {
    const session = await getCachedSession();
    const idToken = session?.idToken;
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }
  }

  const res = await globalThis.fetch(url, {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    headers,
  });

  if (res.status === 401) clearSessionCache();
  return res;
}
