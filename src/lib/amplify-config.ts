"use client";

/**
 * Single entry point for configuring AWS Amplify and loading
 * `aws-amplify/auth` in a way that guarantees `Amplify.configure()` runs
 * before any auth helper (signIn, getCurrentUser, fetchAuthSession, ...)
 * is invoked.
 *
 * Why this file does NOT statically import `aws-amplify`:
 *   A static `import { Amplify } from "aws-amplify"` loads the ~2 MB SDK
 *   eagerly AND registers internal Hub listeners during module init.
 *   Those listeners can dispatch auth events before our synchronous
 *   `Amplify.configure(...)` call lands on the singleton, surfacing:
 *
 *     "Amplify has not been configured. Please call Amplify.configure() ..."
 *
 *   on the console twice under React StrictMode's dev double-mount.
 *
 *   Loading the SDK lazily inside `ensureConfigured()` collapses load +
 *   configure into a single microtask — by the time the returned promise
 *   resolves, the singleton config is provably in place.
 *
 *   NEXT_PUBLIC_* vars are inlined by Next.js at build / dev-server start,
 *   so process.env.NEXT_PUBLIC_* always resolves on the client.
 */

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
const hasCognitoEnv = Boolean(userPoolId && userPoolClientId);

let configurePromise: Promise<boolean> | null = null;

function ensureConfigured(): Promise<boolean> {
  if (configurePromise) return configurePromise;

  if (!hasCognitoEnv) {
    configurePromise = Promise.resolve(false);
    return configurePromise;
  }

  configurePromise = (async () => {
    const { Amplify } = await import("aws-amplify");
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
    return true;
  })();

  return configurePromise;
}

/** Resolves to true when Amplify is (now) configured with Cognito credentials. */
export function configureAmplify(): Promise<boolean> {
  return ensureConfigured();
}

/**
 * Returns the `aws-amplify/auth` module, guaranteed to be loaded AFTER
 * `Amplify.configure()` has run. Repeat calls are cache hits (Webpack
 * dedupes the dynamic import).
 */
export async function getAuthModule(): Promise<typeof import("aws-amplify/auth")> {
  const ok = await ensureConfigured();
  if (!ok) {
    throw new Error(
      "Amplify is not configured: NEXT_PUBLIC_COGNITO_USER_POOL_ID / NEXT_PUBLIC_COGNITO_CLIENT_ID are missing."
    );
  }
  return import("aws-amplify/auth");
}
