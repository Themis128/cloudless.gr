"use client";

/**
 * Legacy shim — kept so existing callers don't break.
 * All authentication is now handled by next-auth + Cognito (or Keycloak fallback).
 * configureAmplifyWith returns true when an OIDC provider is configured.
 */

export interface AmplifyAuthConfig {
  userPoolId: string;
  userPoolClientId: string;
}

let configured = false;

export function configureAmplifyWith(_config: AmplifyAuthConfig): boolean {
  if (configured) return true;
  const hasProvider =
    typeof process !== "undefined" &&
    (!!process.env.NEXT_PUBLIC_AUTH_PROVIDER || !!process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER);
  configured = hasProvider;
  return configured;
}

export function isAmplifyConfigured(): boolean {
  return configured;
}
