"use client";

import { Amplify } from "aws-amplify";

/**
 * Configure AWS Amplify with Cognito User Pool credentials.
 *
 * IMPORTANT — Why this module does NOT read `process.env.NEXT_PUBLIC_*` directly:
 *   Turbopack (Next 16) does not inline `process.env.NEXT_PUBLIC_*` references
 *   inside client modules that are reached via a dynamic `import()` chain.
 *   They are emitted as runtime reads against next.js' `process.js` polyfill,
 *   whose `.env` is empty on the client — which left userPoolId / userPoolClientId
 *   as empty strings, `Amplify.configure()` was skipped, and sign-in failed
 *   with "Auth UserPool not configured."
 *
 * Fix: the caller (Server Component in `[locale]/layout.tsx`) reads the env
 * at SSR — where process.env works natively — and passes the values to
 * `AuthProvider`, which calls `configureAmplifyWith()` synchronously in its
 * mount effect, before any auth helper runs.
 *
 * The configure call here is synchronous (no await) so it lands on the
 * Amplify singleton before `getAuthModule()` returns the auth helpers —
 * matching aws-amplify v6's read-singleton-eagerly behavior.
 */

export interface AmplifyAuthConfig {
  userPoolId: string;
  userPoolClientId: string;
}

let configured = false;

/**
 * Apply the Cognito config to the Amplify singleton. Idempotent — safe to
 * call multiple times (StrictMode dev double-mount, repeated renders).
 * Returns true when Amplify is now configured with non-empty credentials.
 */
export function configureAmplifyWith(config: AmplifyAuthConfig): boolean {
  if (configured) return true;
  if (!config.userPoolId || !config.userPoolClientId) return false;

  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId: config.userPoolId,
          userPoolClientId: config.userPoolClientId,
        },
      },
    },
    { ssr: true }
  );
  configured = true;
  return true;
}

/** True when configureAmplifyWith() has successfully run at least once. */
export function isAmplifyConfigured(): boolean {
  return configured;
}

/**
 * Returns the `aws-amplify/auth` module. Callers must ensure
 * `configureAmplifyWith()` has already run (it happens in AuthProvider's
 * mount effect) before invoking auth helpers like signIn / fetchAuthSession.
 *
 * Bundle-size note: this dynamic import keeps the ~2 MB aws-amplify auth
 * runtime out of the initial public-page bundle. Webpack/Turbopack dedupe
 * the module so repeat calls are cache hits.
 */
export async function getAuthModule(): Promise<typeof import("aws-amplify/auth")> {
  return import("aws-amplify/auth");
}
