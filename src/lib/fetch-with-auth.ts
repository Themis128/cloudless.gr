/**
 * Fetch helper that automatically adds JWT authentication header
 * for protected API routes
 */

import { fetchAuthSession } from "aws-amplify/auth";

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const session = await fetchAuthSession();
    const idToken = session?.tokens?.idToken?.toString();

    const headers: HeadersInit = {
      ...options.headers,
    };

    if (idToken) {
      headers["Authorization"] = `Bearer ${idToken}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    console.error("Failed to get auth session:", err);
    // Fallback to unauthenticated request
    return fetch(url, options);
  }
}
