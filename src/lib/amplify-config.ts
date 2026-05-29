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
 * Single entry point for loading `aws-amplify/auth` in a way that guarantees
 * `Amplify.configure()` has executed first.
 *
 * Why this exists:
 *   AuthContext lazy-imports `aws-amplify/auth` to keep the ~2 MB module out
 *   of the initial public-page bundle (preserved here — this function still
 *   uses dynamic `import()`). But the auth helpers are useless until
 *   `Amplify.configure()` has run. Without an explicit barrier a caller
 *   could grab `signIn` etc. before the config side-effect lands and hit:
 *     "Amplify has not been configured. Please call Amplify.configure() …"
 *
 * How the guarantee works:
 *   `await import("./amplify-config")` resolves only after THIS module's
 *   top-level body has executed (the `Amplify.configure()` call above).
 *   We chain the auth import off that resolution, so by the time the auth
 *   module's exports are handed back, configure has provably run.
 *
 *   Bundle-size impact: zero — both imports are dynamic, so `aws-amplify`
 *   stays out of the public-page bundle. Webpack also dedupes module
 *   instances, so subsequent calls are cache hits (no extra wall-clock).
 */
export async function getAuthModule(): Promise<typeof import("aws-amplify/auth")> {
  // Re-import self so the module-load side-effect (Amplify.configure) is
  // observably complete before the auth import is awaited. Cheap on repeat
  // calls — Webpack returns the cached module record.
  await import("./amplify-config");
  return import("aws-amplify/auth");
}
