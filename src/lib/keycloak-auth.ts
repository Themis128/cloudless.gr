"use client";

/**
 * Keycloak auth module — implements the same interface that AuthContext
 * previously called on aws-amplify/auth, so AuthContext needs no changes.
 *
 * Sign-in / sign-out delegate to next-auth's signIn() / signOut() which
 * redirect through Keycloak's Authorization Code + PKCE flow.
 *
 * getCurrentUser / fetchAuthSession read from the next-auth session cookie
 * that is set after the OIDC callback completes.
 *
 * signUp / confirmSignUp / resetPassword / confirmResetPassword are handled
 * by Keycloak's own registration and self-service flows — they redirect to
 * Keycloak's hosted pages.  The AuthContext calls are preserved so the
 * existing signup/forgot-password pages keep working.
 */

import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
import { getSession } from "next-auth/react";

// ── Types matching the aws-amplify/auth surface ───────────────────────────

interface SignInInput {
  username: string;
  password: string;
}
interface SignInOutput {
  isSignedIn: boolean;
  nextStep?: { signInStep: string };
}
interface SignUpInput {
  username: string;
  password: string;
  options?: { userAttributes?: Record<string, string> };
}
interface ConfirmSignUpInput {
  username: string;
  confirmationCode: string;
}
interface ResetPasswordInput {
  username: string;
}
interface ConfirmResetPasswordInput {
  username: string;
  confirmationCode: string;
  newPassword: string;
}
interface ConfirmSignInInput {
  challengeResponse: string;
}
interface UpdateUserAttributesInput {
  userAttributes: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const KC_BASE = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? "";
const KC_CLIENT = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "cloudless-app";

function kcUrl(path: string) {
  return `${KC_BASE}${path}`;
}

// ── Auth operations ────────────────────────────────────────────────────────

async function signIn(_input: SignInInput): Promise<SignInOutput> {
  // Delegates to Keycloak's hosted login page via OIDC Authorization Code flow.
  // next-auth handles PKCE, state, nonce.
  await nextAuthSignIn("keycloak", { redirect: true });
  return { isSignedIn: true };
}

async function signOut(): Promise<void> {
  await nextAuthSignOut({
    callbackUrl: "/",
    redirect: true,
  });
}

async function signUp(input: SignUpInput): Promise<void> {
  // Redirect to Keycloak's self-registration page pre-filled with email
  const regUrl = new URL(kcUrl("/protocol/openid-connect/registrations"));
  regUrl.searchParams.set("client_id", KC_CLIENT);
  regUrl.searchParams.set("response_type", "code");
  regUrl.searchParams.set(
    "redirect_uri",
    `${globalThis.location?.origin ?? ""}/api/auth/callback/keycloak`
  );
  regUrl.searchParams.set("scope", "openid profile email");
  if (input.options?.userAttributes?.email) {
    regUrl.searchParams.set("email", input.options.userAttributes.email);
  }
  globalThis.location.href = regUrl.toString();
}

async function confirmSignUp(_input: ConfirmSignUpInput): Promise<void> {
  // Keycloak sends a verification email automatically — nothing to call here.
  // The user clicks the link in the email and is redirected back.
}

async function resetPassword(input: ResetPasswordInput): Promise<void> {
  // Redirect to Keycloak's forgot-password page
  const url = new URL(kcUrl("/login-actions/reset-credentials"));
  url.searchParams.set("client_id", KC_CLIENT);
  if (input.username) url.searchParams.set("username", input.username);
  globalThis.location.href = url.toString();
}

async function confirmResetPassword(_input: ConfirmResetPasswordInput): Promise<void> {
  // Handled by Keycloak's hosted page — no client-side step needed.
}

async function confirmSignIn(_input: ConfirmSignInInput): Promise<SignInOutput> {
  return { isSignedIn: true };
}

async function getCurrentUser(): Promise<{
  username: string;
  signInDetails?: { loginId?: string };
}> {
  const session = await getSession();
  if (!session?.user) throw new Error("UserNotFoundException");
  return {
    username: session.user.id ?? session.user.email ?? "",
    signInDetails: { loginId: session.user.email ?? undefined },
  };
}

async function fetchAuthSession(): Promise<{
  tokens?: { idToken?: { toString(): string } };
}> {
  const session = await getSession();
  if (!session?.idToken) return { tokens: {} };
  const idToken = session.idToken;
  return {
    tokens: {
      idToken: { toString: () => idToken },
    },
  };
}

async function fetchUserAttributes(): Promise<Record<string, string>> {
  const session = await getSession();
  if (!session?.user) return {};
  return {
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    sub: session.user.id ?? "",
  };
}

async function updateUserAttributes(input: UpdateUserAttributesInput): Promise<void> {
  // Call the Keycloak Account REST API to update attributes.
  const session = await getSession();
  if (!session?.accessToken) throw new Error("Not authenticated");

  const body: Record<string, unknown> = {};
  if (input.userAttributes.name) body.firstName = input.userAttributes.name;
  if (input.userAttributes.given_name) body.firstName = input.userAttributes.given_name;
  if (input.userAttributes.phone_number)
    body.attributes = {
      ...(body.attributes as object),
      phone: [input.userAttributes.phone_number],
    };

  // Custom attributes go into Keycloak user attributes
  const customAttrs: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(input.userAttributes)) {
    if (k.startsWith("custom:")) {
      customAttrs[k.slice(7)] = [v];
    }
  }
  if (Object.keys(customAttrs).length > 0) {
    body.attributes = {
      ...((body.attributes as object) ?? {}),
      ...customAttrs,
    };
  }

  const res = await globalThis.fetch(`${KC_BASE}/account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to update profile: ${res.status}`);
}

// ── Exported module ───────────────────────────────────────────────────────

export const keycloakAuthModule = {
  signIn,
  signOut,
  signUp,
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
  confirmSignIn,
  getCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
  updateUserAttributes,
};
