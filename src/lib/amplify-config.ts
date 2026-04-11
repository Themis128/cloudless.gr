"use client";

import { Amplify } from "aws-amplify";

let configured = false;

export function configureAmplify(): boolean {
  if (configured) return true;

  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  if (!userPoolId || !clientId) {
    return false;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: clientId,
      },
    },
  });

  configured = true;
  return true;
}
