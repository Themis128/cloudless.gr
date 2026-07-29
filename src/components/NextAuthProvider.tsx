"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Cognito/OIDC flows use next-auth SessionProvider (CSRF + /api/auth/session).
 * D1 email/password auth is owned by AuthContext → /api/auth/session (custom
 * route). Mounting SessionProvider in D1 mode still polls Auth.js endpoints;
 * when Cloudflare (or a misconfigured AUTH_URL) returns HTML, Auth.js throws
 * ClientFetchError: Unexpected token '<' … is not valid JSON.
 */
const USE_NEXTAUTH_SESSION =
  process.env.NEXT_PUBLIC_AUTH_PROVIDER === "cognito";

export default function NextAuthProvider({ children }: { children: ReactNode }) {
  if (!USE_NEXTAUTH_SESSION) {
    return children;
  }
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      {children}
    </SessionProvider>
  );
}
