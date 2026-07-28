"use client";

/**
 * Cognito auth module — implements the same interface that AuthContext
 * previously called on aws-amplify/auth (and, before this, the Keycloak shim).
 *
 * Sign-in / sign-out delegate to next-auth's signIn() / signOut() which
 * redirect through the Cognito Hosted UI (Authorization Code + PKCE flow).
 *
 * getCurrentUser / fetchAuthSession read from the next-auth session cookie
 * that is set after the OIDC callback completes.
 *
 * signUp / resetPassword redirect to the Cognito Hosted UI signup / forgot
 * password pages. confirmSignUp / confirmResetPassword are handled by
 * Cognito's hosted flows, so they are no-ops here.
 */

import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
import { getSession } from "next-auth/react";

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

const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "";
const COGNITO_CLIENT = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";

function hostedUiUrl(path: string) {
  return `${COGNITO_DOMAIN}${path}`;
}

// ── Auth operations ────────────────────────────────────────────────────────

async function signIn(_input: SignInInput): Promise<SignInOutput> {
  // Delegates to the Cognito Hosted UI via OIDC Authorization Code flow.
  // next-auth handles PKCE, state, nonce.
  await nextAuthSignIn("cognito", { redirect: true });
  return { isSignedIn: true };
}

async function signOut(): Promise<void> {
  await nextAuthSignOut({ callbackUrl: "/", redirect: true });
}

async function signUp(input: SignUpInput): Promise<void> {
  // Redirect to the Cognito Hosted UI signup page.
  const url = new URL(hostedUiUrl("/signup"));
  url.searchParams.set("client_id", COGNITO_CLIENT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "redirect_uri",
    `${globalThis.location?.origin ?? ""}/api/auth/callback/cognito`
  );
  url.searchParams.set("scope", "openid profile email");
  if (input.options?.userAttributes?.email) {
    url.searchParams.set("login_hint", input.options.userAttributes.email);
  }
  globalThis.location.href = url.toString();
}

async function confirmSignUp(_input: ConfirmSignUpInput): Promise<void> {
  // Cognito Hosted UI handles email verification — nothing to call here.
}

async function resetPassword(input: ResetPasswordInput): Promise<void> {
  // Redirect to the Cognito Hosted UI forgot-password page.
  const url = new URL(hostedUiUrl("/forgotPassword"));
  url.searchParams.set("client_id", COGNITO_CLIENT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "redirect_uri",
    `${globalThis.location?.origin ?? ""}/api/auth/callback/cognito`
  );
  if (input.username) url.searchParams.set("login_hint", input.username);
  globalThis.location.href = url.toString();
}

async function confirmResetPassword(_input: ConfirmResetPasswordInput): Promise<void> {
  // Handled by the Cognito Hosted UI — no client-side step needed.
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
  return { tokens: { idToken: { toString: () => idToken } } };
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

async function updateUserAttributes(_input: UpdateUserAttributesInput): Promise<void> {
  // Profile attribute updates are managed via Cognito (Hosted UI / admin API).
  // Self-service attribute writes are not exposed through this client shim;
  // use the admin users API route for server-side changes.
  throw new Error("updateUserAttributes is not supported via the client shim");
}

// ── Exported module ───────────────────────────────────────────────────────

export const cognitoAuthModule = {
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
