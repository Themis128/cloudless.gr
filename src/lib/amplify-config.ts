"use client";

/**
 * Auth configuration shim — Keycloak via next-auth replaces aws-amplify/Cognito.
 *
 * Exports the same interface as the old amplify-config so AuthContext and
 * other callers require zero changes.  The actual auth work is done by
 * next-auth (src/lib/auth.ts) and the Keycloak OIDC provider.
 */

export interface AmplifyAuthConfig {
  /** Kept for interface compatibility — unused with Keycloak. */
  userPoolId: string;
  /** Kept for interface compatibility — unused with Keycloak. */
  userPoolClientId: string;
}

let configured = false;

/**
 * No-op with Keycloak — next-auth reads KEYCLOAK_* env vars at module load.
 * Returns true as long as KEYCLOAK_ISSUER is set (both credentials are SSR-only).
 */
export function configureAmplifyWith(_config: AmplifyAuthConfig): boolean {
  if (configured) return true;
  const hasIssuer = typeof process !== "undefined" && !!process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
  configured = hasIssuer;
  return configured;
}

export function isAmplifyConfigured(): boolean {
  return configured;
}

/**
 * Returns a Keycloak-backed auth module that matches the subset of
 * aws-amplify/auth used by AuthContext:
 *   signIn, signOut, signUp, confirmSignUp,
 *   resetPassword, confirmResetPassword, confirmSignIn,
 *   getCurrentUser, fetchAuthSession, fetchUserAttributes,
 *   updateUserAttributes
 */
export async function getAuthModule() {
  const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
  return keycloakAuthModule;
}
