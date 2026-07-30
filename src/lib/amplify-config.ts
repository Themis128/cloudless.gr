"use client";

/**
 * Legacy shim — Cognito/Amplify auth has been removed from production.
 * Kept so existing test callers don't break. configureAmplifyWith returns true
 * when any NEXT_PUBLIC_AUTH_PROVIDER is set (tests only).
 */

export interface AmplifyAuthConfig {
  userPoolId: string;
  userPoolClientId: string;
}

let configured = false;

export function configureAmplifyWith(_config: AmplifyAuthConfig): boolean {
  if (configured) return true;
  const hasProvider = typeof process !== "undefined" && !!process.env.NEXT_PUBLIC_AUTH_PROVIDER;
  configured = hasProvider;
  return configured;
}

export function isAmplifyConfigured(): boolean {
  return configured;
}
