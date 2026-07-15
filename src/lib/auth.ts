/**
 * next-auth v5 configuration wired to AWS Cognito.
 *
 * Replaces the previous Keycloak provider. Cognito is the auth backend for
 * both the k3s (Pi) cluster deployment and the AWS Lambda (serverless)
 * deployment.
 *
 * Token storage: next-auth stores the session in a signed+encrypted JWT
 * cookie (no server-side DB needed). The id/access tokens from Cognito are
 * forwarded to the browser so proxy.ts can validate them directly.
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Cognito from "next-auth/providers/cognito";

const COGNITO_REGION = process.env.AWS_REGION ?? "us-east-1";
const COGNITO_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? "";
const COGNITO_ISSUER = COGNITO_POOL_ID
  ? `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_POOL_ID}`
  : "";

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
    Cognito({
      clientId: process.env.COGNITO_CLIENT_ID ?? "",
      clientSecret: process.env.COGNITO_CLIENT_SECRET ?? "",
      issuer: COGNITO_ISSUER,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        const p = profile as Record<string, unknown> | undefined;
        token.groups = (p?.["cognito:groups"] as string[]) ?? [];
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
