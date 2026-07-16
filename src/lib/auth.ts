/**
 * next-auth v5 configuration - Supports both Cognito OIDC and local Credentials.
 * 
 * Cognito OIDC provider for AWS Lambda deployments (production).
 * Credentials provider for Cloudflare Workers with D1 storage.
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Cognito from "next-auth/providers/cognito";
import type { NextRequest } from "next/server";
import { verifyPassword, getUserByEmail, createSession } from "./auth-local";
import { D1Database } from "@cloudflare/workers-types";

interface Env {
  AUTH_DB: D1Database;
}

function getDb(request: NextRequest): D1Database | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

// Extend the session user type
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    idToken?: string;
    user: {
      id: string;
      company?: string;
      phone?: string;
      groups?: string[];
      roles?: string[];
    } & DefaultSession["user"];
  }
}

// Extend the JWT token type
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    company?: string;
    phone?: string;
    groups?: string[];
    accessToken?: string;
    idToken?: string;
  }
}

/**
 * Returns "credentials" for local auth
 */
export function getAuthProvider(): "credentials" | null {
  return "credentials";
}

// Check if Cognito is configured (required for production)
// Also check for placeholder values - Cognito issuer must be a valid AWS URL
const isCognitoConfigured = !!(
  process.env.COGNITO_CLIENT_ID && 
  process.env.COGNITO_CLIENT_SECRET && 
  process.env.COGNITO_ISSUER &&
  process.env.COGNITO_ISSUER.includes("amazonaws.com")
);

// NextAuth configuration
const nextAuth = NextAuth({
  secret: process.env.AUTH_SECRET ?? "dev-secret-do-not-use-in-production-minimum-32-chars!!",
  providers: [
    // Cognito OIDC provider - for AWS Lambda deployments (only when configured)
    ...(isCognitoConfigured ? [
      Cognito({
        id: "cognito",
        clientId: process.env.COGNITO_CLIENT_ID,
        clientSecret: process.env.COGNITO_CLIENT_SECRET,
        issuer: process.env.COGNITO_ISSUER,
      }),
    ] : []),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const db = getDb(req as NextRequest);
        if (!db) {
          console.error("[auth] AUTH_DB not configured");
          return null;
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        try {
          const user = await getUserByEmail(db, email);
          
          if (!user) {
            return null;
          }

          const isValid = await verifyPassword(password, user.passwordHash);
          if (!isValid) {
            return null;
          }

          // Create session
          await createSession(db, user.id);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            company: user.company,
            phone: user.phone
          };
        } catch (error) {
          console.error("[auth] authorize error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: { token: any; user?: any }) {
      // Cognito OIDC returns user with id, email, name, etc.
      // Credentials provider returns user with id, email, name, company, phone
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        // Company, phone, and groups come from custom fields
        token.company = user.company;
        token.phone = user.phone;
        token.groups = user["cognito:groups"];
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.company = token.company as string;
        session.user.phone = token.phone as string;
        session.user.groups = token.groups as string[];
        session.user.roles = token.groups as string[];
      }
      // Expose tokens to client for API calls (Cognito flow)
      session.accessToken = token.accessToken;
      session.idToken = token.idToken;
      return session;
    }
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    },
  },
});

export const { handlers, signIn, signOut, auth } = nextAuth;

export const { GET, POST } = handlers;