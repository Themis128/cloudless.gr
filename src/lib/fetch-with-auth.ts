/**
 * Fetch wrapper that automatically adds JWT token from Cognito.
 * For use on the client side in authenticated pages.
 *
 * IMPORTANT: This module MUST NOT statically import from `aws-amplify/auth`.
 * Anything that statically imports this file would also pull in the ~2 MB
 * aws-amplify runtime into the initial bundle, AND — because aws-amplify
 * auto-initializes its credentials provider on first load — would surface
 * the
 *
 *   "Amplify has not been configured. Please call Amplify.configure() ..."
 *
 * warning on every page that consumes a fetchWithAuth caller, before the
 * configure side-effect in `@/lib/amplify-config` has run.
 *
 * Route all auth-module access through `getAuthModule()` (which awaits the
 * config side-effect before handing back `aws-amplify/auth`). See the
 * long doc comment in `src/lib/amplify-config.ts` for the contract.
 */

export async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  try {
    const { fetchAuthSession } = await (await import("@/lib/amplify-config")).getAuthModule();
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();

    if (!idToken) {
      throw new Error("No ID token available");
    }

    const headers: Record<string, string> = {
      ...((init?.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${idToken}`,
    };

    return globalThis.fetch(url, {
      ...init,
      headers,
    });
  } catch (error) {
    console.error("fetchWithAuth error:", error);
    throw error;
  }
}
