"use client";

/**
 * Legacy shim — kept so any remaining callers don't break.
 * All authentication is handled by next-auth + Keycloak.
 *
 * configureAmplifyWith returns true only when NEXT_PUBLIC_KEYCLOAK_ISSUER
 * is set, preserving the original contract so existing test coverage holds.
 */

export interface AmplifyAuthConfig {
  userPoolId: string;
  userPoolClientId: string;
}

let configured = false;

export function configureAmplifyWith(_config: AmplifyAuthConfig): boolean {
  if (configured) return true;
  const hasIssuer =
    typeof process !== "undefined" && !!process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
  configured = hasIssuer;
  return configured;
}

export function isAmplifyConfigured(): boolean {
  return configured;
}

export async function getAuthModule() {
  const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
  return keycloakAuthModule;
}
