"use client";

/**
 * Fetch wrapper for admin/API calls.
 * Cookie session only — same-origin fetch sends the HttpOnly `session_token`.
 */

/** No-op retained for API stability (call after sign-in / sign-out or on 401). */
export function clearSessionCache(): void {}

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
