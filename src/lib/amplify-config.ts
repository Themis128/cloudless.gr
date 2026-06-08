"use client";

/**
 * Auth configuration shim — AWS Cognito (via next-auth) is the auth backend.
 *
 * Exports the same interface as the old amplify-config so AuthContext and
 * other callers require zero changes. The actual auth work is done by
 * next-auth (src/lib/auth.ts) and the Cognito OIDC provider.
 */

export interface AmplifyAuthConfig {
  /** Kept for interface compatibility. */
  userPoolId: string;
  /** Kept for interface compatibility. */
  userPoolClientId: string;
}

let configured = false;

/**
 * Returns true as long as the Cognito user pool is configured.
 * next-auth reads COGNITO_* env vars at module load (SSR-only).
 */
export function configureAmplifyWith(_config: AmplifyAuthConfig): boolean {
  if (configured) return true;
  const hasPool =
    typeof process !== "undefined" && !!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  configured = hasPool;
  return configured;
}

export function isAmplifyConfigured(): boolean {
  return configured;
}

/**
 * Returns a Cognito-backed auth module that matches the subset of
 * aws-amplify/auth used by AuthContext:
 *   signIn, signOut, signUp, confirmSignUp,
 *   resetPassword, confirmResetPassword, confirmSignIn,
 *   getCurrentUser, fetchAuthSession, fetchUserAttributes,
 *   updateUserAttributes
 */
export async function getAuthModule() {
  const { cognitoAuthModule } = await import("@/lib/cognito-auth");
  return cognitoAuthModule;
}
