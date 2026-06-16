"use client";

/**
 * Fetch wrapper that adds the access token from the next-auth session.
 *
 * For same-origin browser requests, the next-auth session cookie is sent
 * automatically and api-auth.ts reads it server-side via auth(). The Bearer
 * header is still set as defense-in-depth (external reverse proxies,
 * non-cookie contexts, and for the portal pages that call fetchWithAuth
 * from WaitingRoomClient).
 *
 * The session is cached at module scope for a short TTL so the admin layout's
 * parallel fan-out (PendingClients + ClientPortals + Workspaces + …) doesn't
 * trigger N separate /api/auth/session round-trips on boot. Measured on real
 * traffic before this cache: 9× /api/auth/session in 15s during the admin
 * page paint. After: typically 1×. TTL is intentionally short so a fresh
 * sign-in / sign-out / token refresh is reflected within ~5s. On any 401
 * response we clear the cache so the next call refetches a possibly-rotated
 * session.
 */

import { getSession } from "next-auth/react";

const CACHE_TTL_MS = 5000;

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
  const session = await getCachedSession();
  const idToken = session?.idToken;

  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) || {}),
  };

  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const res = await globalThis.fetch(url, {
    ...init,
    headers,
  });

  // A 401 means the cached token is stale (refresh rotation, sign-out from
  // another tab, etc.). Clear so the next caller refetches the session.
  if (res.status === 401) clearSessionCache();
  return res;
}
