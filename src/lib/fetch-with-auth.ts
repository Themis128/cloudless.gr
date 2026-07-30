"use client";

/**
 * Fetch wrapper for admin/API calls.
 * Relies on the HttpOnly `session_token` cookie (D1 auth) — same-origin
 * fetch sends cookies. Cognito Bearer tokens were removed (PR-05).
 */

/** Invalidate any client session cache. Call after sign-in / sign-out or on 401. */
export function clearSessionCache(): void {
  /* no Cognito session cache */
}

export async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) || {}),
  };

  return globalThis.fetch(url, {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    headers,
  });
}
