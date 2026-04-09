/**
 * Fetch wrapper that automatically adds JWT token from Cognito
 * For use on the client side in authenticated pages
 */

import { fetchAuthSession } from "aws-amplify/auth";

export async function fetchWithAuth(
  url: string,
  init?: RequestInit
): Promise<Response> {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    
    if (!idToken) {
      throw new Error("No ID token available");
    }

    const headers: Record<string, string> = {
      ...((init?.headers as Record<string, string>) || {}),
      "Authorization": `Bearer ${idToken}`,
    };

    return fetch(url, {
      ...init,
      headers,
    });
  } catch (error) {
    console.error("fetchWithAuth error:", error);
    throw error;
  }
}
