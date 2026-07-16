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
  UserAlreadyAuthenticatedException: "You are already signed in.",
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

/** Map raw error messages to user-friendly strings. */
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

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const loadUserProfile = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = (await res.json()) as {
          user?: { id?: string; email?: string; name?: string; company?: string; phone?: string };
          isAdmin?: boolean;
        } | null;
        if (data?.user) {
          const { id, email, name, company, phone } = data.user;
          setUser({
            username: id ?? email ?? "",
            email: email ?? undefined,
            name: name ?? undefined,
            company: company ?? undefined,
            phone: phone ?? undefined,
            preferences: { ...DEFAULT_PREFERENCES },
          });
          setIsAdmin(data.isAdmin ?? false);
          return;
        }
      }
      setUser(null);
      setIsAdmin(false);
    } catch (err) {
      console.error("[AuthProvider] loadUserProfile error:", err);
      setUser(null);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUserProfile();
  }, [loadUserProfile]);

  const handleSignIn = async (email: string, password: string): Promise<SignInResult> => {
    try {
      const result = await nextAuthSignIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/auth/post-login",
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      await loadUserProfile();
      return {};
    } catch (err: unknown) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleSignUp = async (email: string, password: string, name?: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName: name }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Sign up failed");
      }
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleSignOut = async () => {
    await nextAuthSignOut({ callbackUrl: "/" });
    setUser(null);
    setIsAdmin(false);
  };

  const handleConfirmSignUp = async (_email: string, _code: string) => {
    throw new Error("Email verification not implemented for local auth");
  };

  const handleForgotPassword = async (email: string) => {
    try {
      await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleConfirmForgotPassword = async (email: string, code: string, newPassword: string) => {
    try {
      await fetch("/api/auth/reset-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleCompleteNewPassword = async (_newPassword: string) => {
    throw new Error("New password setup not implemented for local auth");
  };

  const handleUpdateProfile = async (attrs: {
    name?: string;
    company?: string;
    phone?: string;
  }) => {
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attrs),
      });
      if (!res.ok) {
        throw new Error("Failed to update profile");
      }
      await loadUserProfile();
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleUpdatePreferences = async (prefs: Partial<UserPreferences>) => {
    try {
      setUser((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, ...prefs } } : prev));
    } catch {
      throw new Error("Failed to update preferences");
    }
  };

  const handleRefreshProfile = async () => {
    await loadUserProfile();
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
