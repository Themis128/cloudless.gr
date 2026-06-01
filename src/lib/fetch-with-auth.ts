"use client";

/**
 * Fetch wrapper that adds the Keycloak access token from the next-auth session.
 *
 * For same-origin browser requests, the next-auth session cookie is sent
 * automatically and api-auth.ts reads it server-side via auth(). The Bearer
 * header is still set as defense-in-depth (external reverse proxies,
 * non-cookie contexts, and for the portal pages that call fetchWithAuth
 * from WaitingRoomClient).
 */

import { getSession } from "next-auth/react";

export async function fetchWithAuth(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const session = await getSession();
  const idToken = session?.idToken;

  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) || {}),
  };

  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  return globalThis.fetch(url, {
    ...init,
    headers,
  });
}
