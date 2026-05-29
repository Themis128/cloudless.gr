"use client";

import { Amplify } from "aws-amplify";

/**
 * Configure AWS Amplify with Cognito User Pool credentials.
 *
 * Called at module load time (not inside useEffect) so the config is in place
 * before any auth function (signIn, getCurrentUser, ...) is invoked.
 *
 * NEXT_PUBLIC_* vars are inlined by Next.js at build/dev-server start,
 * so process.env.NEXT_PUBLIC_* always resolves on the client without needing
 * globalThis.process?.env.
 *
 * Returns true when both required vars are present, false otherwise.
 */
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";

const isConfigured = Boolean(userPoolId && userPoolClientId);

if (isConfigured) {
  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
        },
      },
    },
    { ssr: true }
  );
}

/** Returns true when Amplify has been configured with valid Cognito credentials. */
export function configureAmplify(): boolean {
  return isConfigured;
}

/**
 * Awaitable handle that any consumer of `aws-amplify/auth` MUST await before
 * the first auth call. Guarantees Amplify.configure() has run regardless of
 * which lazy-import path landed first.
 *
 * Why this exists: AuthContext lazy-imports both `@/lib/amplify-config` (which
 * runs Amplify.configure as a module side-effect) and `aws-amplify/auth` (which
 * needs configure to have already run). Without a barrier, a sibling component
 * calling an auth helper during first paint can hit Amplify before configure
 * lands, producing:
 *   "Amplify has not been configured. Please call Amplify.configure() ..."
 *
 * Importing this module is the synchronization barrier: the side-effect block
 * above runs at module-load, then awaiting `ensureAmplifyConfigured()` from
 * anywhere is a no-op promise — but it forces the import to resolve first.
 */
export function ensureAmplifyConfigured(): Promise<boolean> {
  return Promise.resolve(isConfigured);
}
