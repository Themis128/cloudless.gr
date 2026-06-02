"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";

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

/** Same-origin route that reads (GET) and writes (POST) Keycloak profile attributes. */
const PROFILE_ENDPOINT = "/api/user/profile";

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

function isAdminFromSession(user: { groups?: string[]; roles?: string[] }): boolean {
  return (
    (user.groups ?? []).includes("admin") ||
    (user.roles ?? []).includes("admin") ||
    (user.roles ?? []).includes("realm:admin")
  );
}

/**
 * Pull the user's Keycloak profile attributes (company/phone/preferences) that
 * the session token does not carry, merging them onto the base user. Returns
 * the base unchanged on any failure so auth state never depends on it. Without
 * this, the Profile/Settings forms render blank on every load even after a save.
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
        error?: string;
      } | null;

      if (data?.error === "RefreshTokenError") {
        // Refresh token expired — clear session so login page shows
        await nextAuthSignOut({ redirect: false });
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
        setIsAdmin(isAdminFromSession(data.user));
        // Enrich with Keycloak profile attributes (company/phone/preferences)
        // the session JWT doesn't carry, so saved values render instead of
        // blanks. Best-effort — falls back to the session-only user.
        setUser(await enrichWithProfile(base));
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

  // Sign-in delegates entirely to next-auth/Keycloak OIDC flow.
  // The email/password arguments are ignored — Keycloak shows its own
  // hosted login page. They're kept in the signature for interface compat
  // with any callers that pass them (e.g. legacy login form).
  const handleSignIn = async (_email: string, _password: string): Promise<SignInResult> => {
    await nextAuthSignIn("keycloak", { redirect: true });
    return {};
  };

  const handleSignUp = async (_email: string, _password: string, _name?: string) => {
    const issuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? "";
    const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "cloudless-app";
    if (!issuer) return;
    const url = new URL(`${issuer}/protocol/openid-connect/registrations`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "redirect_uri",
      `${globalThis.location?.origin ?? ""}/api/auth/callback/keycloak`
    );
    url.searchParams.set("scope", "openid profile email");
    globalThis.location.href = url.toString();
  };

  const handleSignOut = async () => {
    setUser(null);
    setIsAdmin(false);
    await nextAuthSignOut({ callbackUrl: "/" });
  };

  const handleConfirmSignUp = async (_email: string, _code: string) => {
    // Keycloak handles email verification via its own hosted flow.
  };

  const handleForgotPassword = async (email: string) => {
    const issuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? "";
    const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "cloudless-app";
    if (!issuer) return;
    const url = new URL(`${issuer}/login-actions/reset-credentials`);
    url.searchParams.set("client_id", clientId);
    if (email) url.searchParams.set("username", email);
    globalThis.location.href = url.toString();
  };

  const handleConfirmForgotPassword = async (
    _email: string,
    _code: string,
    _newPassword: string
  ) => {
    // Handled by Keycloak hosted page — no client-side step needed.
  };

  const handleCompleteNewPassword = async (_newPassword: string) => {
    // Keycloak handles forced password reset via its hosted flow.
  };

  const handleUpdateProfile = async (attrs: {
    name?: string;
    company?: string;
    phone?: string;
  }) => {
    // Go through our own same-origin API route. A direct browser fetch to
    // Keycloak's Account API (auth.cloudless.gr) is cross-origin and is blocked
    // by CORS → the opaque "Failed to fetch". The server route uses the user's
    // access token to update Keycloak with no CORS constraint.
    const res = await globalThis.fetch(PROFILE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attrs),
    });
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
    // Persist via our same-origin route (browser → Keycloak is CORS-blocked).
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
