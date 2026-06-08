"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

// aws-amplify/auth is loaded via getAuthModule() (see src/lib/amplify-config.ts)
// — a thin async wrapper that guarantees Amplify.configure() has run before
// the auth module is handed back. The wrapper preserves the lazy-load: the
// ~2 MB aws-amplify dependency stays out of the public-page bundle.

interface UserPreferences {
  theme: "system" | "dark" | "light";
  language: "en" | "el" | "fr" | "de";
  emailOrders: boolean;
  emailNewsletter: boolean;
  emailMarketing: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  language: "en",
  emailOrders: true,
  emailNewsletter: false,
  emailMarketing: false,
};

export interface AuthUser {
  username: string;
  email?: string;
  name?: string;
  company?: string;
  phone?: string;
  preferences: UserPreferences;
}

interface SignInResult {
  needsNewPassword?: boolean;
  needsConfirmation?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  updateProfile: (attrs: { name?: string; company?: string; phone?: string }) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const DEFAULT_AUTH_CONTEXT: AuthContextType = {
  user: null,
  isAdmin: false,
  isLoading: true,
  configError: null,
  signIn: async () => ({}),
  signUp: async () => {},
  signOut: async () => {},
  confirmSignUp: async () => {},
  forgotPassword: async () => {},
  confirmForgotPassword: async () => {},
  completeNewPassword: async () => {},
  updateProfile: async () => {},
  updatePreferences: async () => {},
  refreshProfile: async () => {},
};

const COGNITO_ERROR_MESSAGES: Record<string, string> = {
  UserAlreadyAuthenticatedException: "You are already signed in. Redirecting\u2026",
  NotAuthorizedException: "Incorrect email or password.",
  UserNotFoundException: "No account found with that email.",
  UsernameExistsException: "An account with that email already exists.",
  CodeMismatchException: "Invalid verification code. Please try again.",
  ExpiredCodeException: "Verification code has expired. Please request a new one.",
  LimitExceededException: "Too many attempts. Please wait a moment and try again.",
  TooManyRequestsException: "Too many attempts. Please wait a moment and try again.",
  InvalidPasswordException:
    "Password does not meet requirements (min. 8 characters, include uppercase, lowercase, and a number).",
  UserNotConfirmedException:
    "Your email has not been verified. Please check your inbox for a verification code.",
};

/** Map raw Cognito/Amplify error messages to user-friendly strings. */
function friendlyAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  const mapped = COGNITO_ERROR_MESSAGES[name];
  if (mapped) return mapped;
  if (message.includes("password")) {
    return "Password does not meet requirements (min. 8 characters, include uppercase, lowercase, and a number).";
  }
  return message.replace(/^[A-Za-z]+Exception:\s*/, "");
}

const AuthContext = createContext<AuthContextType>(DEFAULT_AUTH_CONTEXT);

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return {};
  }
}

interface AuthProviderProps {
  children: ReactNode;
  /**
   * Kept for backwards-compatibility with the layout Server Component.
   * With Cognito these values are unused — next-auth reads COGNITO_*
   * env vars server-side.  Pass empty strings if migrating gradually.
   */
  cognitoConfig?: { userPoolId: string; userPoolClientId: string };
}

function buildProfileUpdates(attrs: {
  name?: string;
  company?: string;
  phone?: string;
}): Record<string, string> {
  const updates: Record<string, string> = {};
  if (attrs.name !== undefined) updates.name = attrs.name;
  if (attrs.phone !== undefined) updates.phone_number = attrs.phone;
  if (attrs.company !== undefined) updates["custom:company"] = attrs.company;
  return updates;
}

function mergeProfileAttrs(
  prev: AuthUser,
  attrs: { name?: string; company?: string; phone?: string }
): Partial<AuthUser> {
  return {
    name: attrs.name ?? prev.name,
    company: attrs.company ?? prev.company,
    phone: attrs.phone ?? prev.phone,
  };
}

export function AuthProvider({
  children,
  cognitoConfig = { userPoolId: "", userPoolClientId: "" },
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const loadUserProfile = useCallback(
    async (username: string, email?: string): Promise<AuthUser> => {
      let name: string | undefined;
      let company: string | undefined;
      let phone: string | undefined;
      let preferences = { ...DEFAULT_PREFERENCES };

      try {
        const { fetchUserAttributes } = await (
          await import("@/lib/amplify-config")
        ).getAuthModule();
        const attrs = await fetchUserAttributes();
        name = attrs.name || attrs.given_name || undefined;
        phone = attrs.phone_number || undefined;
        company = attrs["custom:company"] || undefined;

        const prefsRaw = attrs["custom:preferences"];
        if (prefsRaw) {
          try {
            const parsed = JSON.parse(prefsRaw) as Partial<UserPreferences>;
            preferences = { ...DEFAULT_PREFERENCES, ...parsed };
          } catch {
            /* keep defaults */
          }
        }
      } catch {
        // Attributes not available — use defaults
      }

      return { username, email, name, company, phone, preferences };
    },
    []
  );

  const checkAuth = useCallback(async () => {
    try {
      // Try Cognito/Amplify first (legacy path).
      let amplifyConfigured = false;
      try {
        const { configureAmplifyWith } = await import("@/lib/amplify-config");
        const ok = configureAmplifyWith(cognitoConfig);
        if (!ok) {
          setConfigError("Authentication is not configured for this environment.");
          return;
        }
        amplifyConfigured = true;
      } catch (err) {
        setConfigError(err instanceof Error ? err.message : "Authentication configuration failed");
        return;
      }

      if (amplifyConfigured) {
        try {
          const { getCurrentUser, fetchAuthSession } = await (
            await import("@/lib/amplify-config")
          ).getAuthModule();
          const currentUser = await getCurrentUser();
          const email = currentUser.signInDetails?.loginId;
          const profile = await loadUserProfile(currentUser.username, email);
          setUser(profile);
          // Fetch the session separately so a transient token-refresh failure
          // doesn't clear an already-authenticated user's admin status.
          let groups: string[] = [];
          try {
            const session = await fetchAuthSession();
            const idToken = session.tokens?.idToken?.toString();
            if (idToken) {
              groups = (decodeJwtPayload(idToken)["cognito:groups"] as string[]) ?? [];
            }
          } catch {
            // Session fetch failed (network blip). Keep existing admin state if
            // already set; otherwise default to non-admin.
            groups = [];
          }
          setIsAdmin(groups.includes("admin"));
          return;
        } catch {
          // No legacy Cognito cookie — fall through to next-auth session check.
        }
      }

      // next-auth path: read the server-side session cookie via the
      // next-auth session endpoint. This is active for the Cognito OIDC
      // migration and coexists with Amplify during the rollout.
      try {
        const res = await globalThis.fetch("/api/auth/session");
        if (res.ok) {
          const data = (await res.json()) as {
            user?: { name?: string; email?: string; id?: string; groups?: string[] };
          };
          if (data.user) {
            const { email, name, id, groups: kcGroups = [] } = data.user;
            setUser({
              username: id ?? email ?? "",
              email: email ?? undefined,
              name: name ?? undefined,
              preferences: { ...DEFAULT_PREFERENCES },
            });
            setIsAdmin(kcGroups.includes("admin"));
            return;
          }
        }
      } catch {
        // Network error — treat as unauthenticated.
      }

      setUser(null);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [loadUserProfile, cognitoConfig]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const applySignInResult = async (
    result: Awaited<
      ReturnType<
        Awaited<ReturnType<(typeof import("@/lib/amplify-config"))["getAuthModule"]>>["signIn"]
      >
    >
  ): Promise<SignInResult> => {
    if (result.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
      return { needsNewPassword: true };
    }
    if (result.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
      return { needsConfirmation: true };
    }
    if (result.isSignedIn) {
      await checkAuth();
    }
    return {};
  };

  const handleSignIn = async (email: string, password: string): Promise<SignInResult> => {
    const { signIn: amplifySignIn, signOut: amplifySignOut } = await (
      await import("@/lib/amplify-config")
    ).getAuthModule();
    try {
      return await applySignInResult(await amplifySignIn({ username: email, password }));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "UserAlreadyAuthenticatedException") {
        await amplifySignOut();
        return await applySignInResult(await amplifySignIn({ username: email, password }));
      }
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleSignUp = async (email: string, password: string, name?: string) => {
    const { signUp: amplifySignUp } = await (await import("@/lib/amplify-config")).getAuthModule();
    try {
      const userAttributes: Record<string, string> = { email };
      if (name?.trim()) userAttributes.name = name.trim();
      await amplifySignUp({
        username: email,
        password,
        options: { userAttributes },
      });
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleSignOut = async () => {
    if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
      const { signOut: nextAuthSignOut } = await import("next-auth/react");
      setUser(null);
      setIsAdmin(false);
      await nextAuthSignOut({ callbackUrl: "/" });
      return;
    }
    const { signOut: amplifySignOut } = await (
      await import("@/lib/amplify-config")
    ).getAuthModule();
    await amplifySignOut();
    setUser(null);
    setIsAdmin(false);
  };

  const handleConfirmSignUp = async (email: string, code: string) => {
    const { confirmSignUp: amplifyConfirmSignUp } = await (
      await import("@/lib/amplify-config")
    ).getAuthModule();
    try {
      await amplifyConfirmSignUp({ username: email, confirmationCode: code });
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleForgotPassword = async (email: string) => {
    const { resetPassword: amplifyResetPassword } = await (
      await import("@/lib/amplify-config")
    ).getAuthModule();
    try {
      await amplifyResetPassword({ username: email });
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleConfirmForgotPassword = async (email: string, code: string, newPassword: string) => {
    const { confirmResetPassword: amplifyConfirmResetPassword } = await (
      await import("@/lib/amplify-config")
    ).getAuthModule();
    try {
      await amplifyConfirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword,
      });
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleCompleteNewPassword = async (newPassword: string) => {
    const { confirmSignIn: amplifyConfirmSignIn } = await (
      await import("@/lib/amplify-config")
    ).getAuthModule();
    try {
      const result = await amplifyConfirmSignIn({
        challengeResponse: newPassword,
      });
      if (result.isSignedIn) {
        await checkAuth();
      }
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleUpdateProfile = async (attrs: {
    name?: string;
    company?: string;
    phone?: string;
  }) => {
    try {
      const updates = buildProfileUpdates(attrs);
      if (Object.keys(updates).length > 0) {
        const { updateUserAttributes } = await (
          await import("@/lib/amplify-config")
        ).getAuthModule();
        await updateUserAttributes({ userAttributes: updates });
      }
      setUser((prev) => (prev ? { ...prev, ...mergeProfileAttrs(prev, attrs) } : prev));
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleUpdatePreferences = async (prefs: Partial<UserPreferences>) => {
    try {
      const merged = {
        ...(user?.preferences ?? DEFAULT_PREFERENCES),
        ...prefs,
      };
      const { updateUserAttributes } = await (await import("@/lib/amplify-config")).getAuthModule();
      await updateUserAttributes({
        userAttributes: {
          "custom:preferences": JSON.stringify(merged),
        },
      });
      setUser((prev) => (prev ? { ...prev, preferences: merged } : prev));
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleRefreshProfile = async () => {
    if (!user) return;
    const profile = await loadUserProfile(user.username, user.email);
    setUser(profile);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        configError,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        confirmSignUp: handleConfirmSignUp,
        forgotPassword: handleForgotPassword,
        confirmForgotPassword: handleConfirmForgotPassword,
        completeNewPassword: handleCompleteNewPassword,
        updateProfile: handleUpdateProfile,
        updatePreferences: handleUpdatePreferences,
        refreshProfile: handleRefreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
