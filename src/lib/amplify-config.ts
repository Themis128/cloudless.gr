"use client";

/**
 * Legacy shim — kept only so imports in any remaining callers don't break.
 * All authentication is now handled by next-auth + Keycloak.
 */

export interface AmplifyAuthConfig {
  userPoolId: string;
  userPoolClientId: string;
}

export function configureAmplifyWith(_config: AmplifyAuthConfig): boolean {
  return true;
}

export function isAmplifyConfigured(): boolean {
  return true;
}

export async function getAuthModule() {
  const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
  return keycloakAuthModule;
}
