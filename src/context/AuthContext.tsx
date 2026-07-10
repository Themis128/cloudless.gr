"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { signOut as nextAuthSignOut } from "next-auth/react";
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

const PROFILE_ENDPOINT = "/api/user/profile";
const AUTH_PROVIDER = process.env.NEXT_PUBLIC_AUTH_PROVIDER;
const USE_COGNITO = AUTH_PROVIDER === "cognito" || AUTH_PROVIDER === undefined;

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
  return (user.groups ?? user.roles ?? []).includes("admin");
}

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
        const admin = USE_COGNITO
          ? isAdminFromSession(data.user)
          : (data.isAdmin ?? false);
        setIsAdmin(admin);
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
    checkAuth().catch(() => {});
  }, [checkAuth]);

  const handleSignIn = async (email: string, password: string): Promise<SignInResult> => {
    if (USE_COGNITO) {
      const { signIn } = await import("next-auth/react");
      await signIn("cognito", { redirect: true });
      return {};
    }

    const res = await globalThis.fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; isAdmin?: boolean };
    if (!res.ok) {
      throw new Error(data.error ?? "Sign in failed");
    }
    await checkAuth();
    return {};
  };

  const handleSignUp = async (email: string, password: string, name?: string) => {
    if (USE_COGNITO) {
      const { signIn } = await import("next-auth/react");
      await signIn("cognito", { callbackUrl: "/auth/post-login" });
      return;
    }

    const res = await globalThis.fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName: name }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? "Sign up failed");
    }
  };

  const handleSignOut = async () => {
    setUser(null);
    setIsAdmin(false);
    clearSessionCache();
    if (USE_COGNITO) {
      await nextAuthSignOut({ callbackUrl: "/" });
      return;
    }
    await globalThis.fetch("/api/auth/session", { method: "DELETE" });
    window.location.href = "/";
  };

  const handleConfirmSignUp = async (_email: string, _code: string) => {
    // No-op: signup page handles verification via /api/auth/activate directly
  };

  const handleForgotPassword = async (email: string) => {
    if (USE_COGNITO) {
      const { signIn } = await import("next-auth/react");
      await signIn("cognito", { callbackUrl: "/auth/post-login" });
      return;
    }
    const res = await globalThis.fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? "Password reset failed");
    }
  };

  const handleConfirmForgotPassword = async (email: string, _code: string, newPassword: string) => {
    if (USE_COGNITO) {
      const { signIn } = await import("next-auth/react");
      await signIn("cognito", { callbackUrl: "/auth/post-login" });
      return;
    }
    // Current flow uses token-based reset from email link, not code-based
    await handleForgotPassword(email);
  };

  const handleCompleteNewPassword = async (_newPassword: string) => {
    // Not used in D1 flow
  };

  const handleUpdateProfile = async (attrs: {
    name?: string;
    company?: string;
    phone?: string;
  }) => {
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
    try {
      await globalThis.fetch(PROFILE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: merged }),
      });
    } catch {
      // Non-fatal
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