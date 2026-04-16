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

if (userPoolId && userPoolClientId) {
  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
        },
      },
    },
    { ssr: true },
  );
}

/** Returns true when Amplify has been configured with valid Cognito credentials. */
export function configureAmplify(): boolean {
  return Boolean(userPoolId && userPoolClientId);
}
