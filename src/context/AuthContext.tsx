"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
import { clearSessionCache } from "@/lib/fetch-with-auth";

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

/** Same-origin route that reads (GET) and writes (POST) user profile attributes. */
const PROFILE_ENDPOINT = "/api/user/profile";

const AUTH_PROVIDER = process.env.NEXT_PUBLIC_AUTH_PROVIDER;
const USE_COGNITO = AUTH_PROVIDER === "cognito";
const OIDC_PROVIDER = "cognito";

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

const AuthContext = createContext<AuthContextType>(DEFAULT_AUTH_CONTEXT);

function isAdminFromSession(user: { groups?: string[] }): boolean {
  return (user.groups ?? []).includes("admin");
}

/**
 * Pull the user's stored profile attributes (company/phone/preferences) that
 * the session token does not carry, merging them onto the base user. Served by
 * the provider-agnostic /api/user/profile route (DynamoDB, keyed by sub).
 * Returns the base unchanged on any failure so auth state never depends on it.
 * Without this, the Profile/Settings forms render blank on every load.
 */
async function enrichWithProfile(base: AuthUser): Promise<AuthUser> {
  try {
    const res = await globalThis.fetch(PROFILE_ENDPOINT);
    if (!res.ok) return base;
    const p = (await res.json()) as {
      name?: string;
      company?: string;
      phone?: string;
      preferences?: Partial<UserPreferences>;
    };
    return {
      ...base,
      name: p.name ?? base.name,
      company: p.company ?? base.company,
      phone: p.phone ?? base.phone,
      preferences: { ...base.preferences, ...(p.preferences ?? {}) },
    };
  } catch {
    return base;
  }
}

interface AuthProviderProps {
  readonly children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const configError = null;

  const checkAuth = useCallback(async () => {
    // E2E test bypass: when running under Playwright with NEXT_PUBLIC_E2E=1
    // AND a cookie e2e_admin=1 is present, short-circuit to an admin session.
    // Production never sets NEXT_PUBLIC_E2E, so this branch is dead code in prod.
    if (
      typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_E2E === "1" &&
      document.cookie.includes("e2e_admin=1")
    ) {
      setUser({
        username: "e2e-admin",
        email: "e2e-admin@cloudless.test",
        preferences: DEFAULT_PREFERENCES,
      });
      setIsAdmin(true);
      setIsLoading(false);
      return;
    }
    try {
      const res = await globalThis.fetch("/api/auth/session");
      if (!res.ok) {
        setUser(null);
        setIsAdmin(false);
        return;
      }
      const data = (await res.json()) as {
        user?: {
          id?: string;
          name?: string;
          email?: string;
          groups?: string[];
          roles?: string[];
        };
        isAdmin?: boolean;
        error?: string;
      } | null;

      if (data?.error === "RefreshTokenError") {
        // Refresh token expired — clear session so login page shows
        if (USE_COGNITO) {
          await nextAuthSignOut({ redirect: false });
        } else {
          await globalThis.fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
        }
        setUser(null);
        setIsAdmin(false);
        return;
      }

      if (data?.user) {
        const base: AuthUser = {
          username: data.user.id ?? data.user.email ?? "",
          email: data.user.email ?? undefined,
          name: data.user.name ?? undefined,
          preferences: { ...DEFAULT_PREFERENCES },
        };
        setIsAdmin(Boolean(data.isAdmin) || isAdminFromSession(data.user));
        // Render the session-only user immediately so isLoading flips false
        // and the admin layout stops showing the centred spinner. The profile
        // enrichment (company/phone/preferences) runs without await — when it
        // resolves it patches the state in. Avoids blocking the whole admin
        // boot on /api/user/profile, which returns 413 today because the
        // Cognito-cookie + headers combo exceeds the edge header limit
        // (documented in src/lib/auth.ts:172). The 413 itself is harmless —
        // enrichWithProfile swallows it and returns the base — but awaiting
        // it added a full request RTT to every admin page load.
        setUser(base);
        void enrichWithProfile(base).then((enriched) => {
          if (enriched !== base) setUser(enriched);
        });
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    } catch {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth().catch(() => {}); // eslint-disable-line react-hooks/set-state-in-effect
  }, [checkAuth]);

  // D1: email/password → POST /api/auth/login (session_token cookie).
  // Cognito: Hosted UI via next-auth (email/password ignored).
  const handleSignIn = async (email: string, password: string): Promise<SignInResult> => {
    if (USE_COGNITO) {
      await nextAuthSignIn(OIDC_PROVIDER, { redirect: true });
      return {};
    }

    const res = await globalThis.fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      user?: { id?: string; email?: string; name?: string; company?: string; phone?: string };
      isAdmin?: boolean;
    } | null;

    if (!res.ok || !data?.ok || !data.user) {
      throw new Error(data?.error ?? "Sign in failed");
    }

    const base: AuthUser = {
      username: data.user.id ?? data.user.email ?? email,
      email: data.user.email ?? email,
      name: data.user.name ?? undefined,
      company: data.user.company ?? undefined,
      phone: data.user.phone ?? undefined,
      preferences: { ...DEFAULT_PREFERENCES },
    };
    setIsAdmin(Boolean(data.isAdmin));
    setUser(base);
    void enrichWithProfile(base).then((enriched) => {
      if (enriched !== base) setUser(enriched);
    });
    return {};
  };

  const handleSignUp = async (_email: string, _password: string, _name?: string) => {
    if (USE_COGNITO) {
      await nextAuthSignIn(OIDC_PROVIDER, { callbackUrl: "/auth/post-login" });
      return;
    }
    // D1 signup is handled by the signup page → /api/auth/register*
  };

  const handleSignOut = async () => {
    setUser(null);
    setIsAdmin(false);
    clearSessionCache();
    if (USE_COGNITO) {
      await nextAuthSignOut({ callbackUrl: "/" });
      return;
    }
    await globalThis.fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
  };

  const handleConfirmSignUp = async (_email: string, _code: string) => {
    // Cognito: hosted flow. D1: activate routes on signup page.
  };

  const handleForgotPassword = async (email: string) => {
    if (USE_COGNITO) {
      await nextAuthSignIn(OIDC_PROVIDER, { callbackUrl: "/auth/post-login" });
      return;
    }
    const res = await globalThis.fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Password reset failed");
    }
  };

  const handleConfirmForgotPassword = async (
    _email: string,
    _code: string,
    _newPassword: string
  ) => {
    // Cognito Hosted UI / D1 reset-confirm page.
  };

  const handleCompleteNewPassword = async (_newPassword: string) => {
    // Cognito Hosted UI only.
  };

  const handleUpdateProfile = async (attrs: {
    name?: string;
    company?: string;
    phone?: string;
  }) => {
    // Go through our own same-origin API route, which persists the profile in
    // DynamoDB keyed by the Cognito user sub. Retry once on 502/503 (Pi origin
    // may lack DynamoDB; retry hits AWS via Cloudflare Worker failover).
    const doFetch = () =>
      globalThis.fetch(PROFILE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attrs),
      });

    let res = await doFetch();
    if (
      (res.status === 502 || res.status === 503) &&
      res.headers.get("x-served-by") !== "aws-fallback"
    ) {
      // Retry once — the Worker may route to AWS on the second attempt
      res = await doFetch();
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? `Failed to update profile: ${res.status}`);
    }

    setUser((prev) =>
      prev
        ? {
            ...prev,
            name: attrs.name ?? prev.name,
            company: attrs.company ?? prev.company,
            phone: attrs.phone ?? prev.phone,
          }
        : prev
    );
  };

  const handleUpdatePreferences = async (prefs: Partial<UserPreferences>) => {
    const merged = {
      ...(user?.preferences ?? DEFAULT_PREFERENCES),
      ...prefs,
    };
    setUser((prev) => (prev ? { ...prev, preferences: merged } : prev));
    // Persist via our same-origin route.
    try {
      await globalThis.fetch(PROFILE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: merged }),
      });
    } catch {
      // Non-fatal — preferences are kept in local state
    }
  };

  const handleRefreshProfile = async () => {
    await checkAuth();
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
