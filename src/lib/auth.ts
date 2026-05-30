/**
 * next-auth v5 configuration wired to Keycloak.
 *
 * Replaces aws-amplify / Cognito as the auth backend for both the
 * k3s (Pi) cluster deployment and the AWS Lambda (serverless) deployment.
 *
 * Token storage: next-auth stores the session in a signed+encrypted JWT
 * cookie (no server-side DB needed). The access token from Keycloak is
 * forwarded to the browser so proxy.ts can validate it directly.
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    idToken?: string;
    user: {
      id: string;
      groups?: string[];
    } & DefaultSession["user"];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID ?? "",
      clientSecret: "",
      issuer: process.env.KEYCLOAK_ISSUER ?? "",
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        const p = profile as Record<string, unknown> | undefined;
        token.groups = (p?.["groups"] as string[]) ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.idToken = token.idToken as string | undefined;
      session.user.id = token.sub ?? "";
      session.user.groups = (token.groups as string[]) ?? [];
      return session;
    },
  },
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
});
