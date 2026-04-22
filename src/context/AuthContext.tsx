"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// aws-amplify is imported lazily inside each async function so the ~2 MB
// module is excluded from the initial JS bundle, reducing TBT on public pages.

interface UserPreferences {
  theme: "system" | "dark" | "light";
  language: "en" | "el" | "fr";
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
  confirmForgotPassword: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<void>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  updateProfile: (attrs: {
    name?: string;
    company?: string;
    phone?: string;
  }) => Promise<void>;
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

/**
 * Map raw Cognito/Amplify error messages to user-friendly strings.
 */
function friendlyAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";

  if (name === "UserAlreadyAuthenticatedException") {
    return "You are already signed in. Redirecting\u2026";
  }
  if (name === "NotAuthorizedException") {
    return "Incorrect email or password.";
  }
  if (name === "UserNotFoundException") {
    return "No account found with that email.";
  }
  if (name === "UsernameExistsException") {
    return "An account with that email already exists.";
  }
  if (name === "CodeMismatchException") {
    return "Invalid verification code. Please try again.";
  }
  if (name === "ExpiredCodeException") {
    return "Verification code has expired. Please request a new one.";
  }
  if (
    name === "LimitExceededException" ||
    name === "TooManyRequestsException"
  ) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (name === "InvalidPasswordException" || message.includes("password")) {
    return "Password does not meet requirements (min. 8 characters, include uppercase, lowercase, and a number).";
  }
  if (name === "UserNotConfirmedException") {
    return "Your email has not been verified. Please check your inbox for a verification code.";
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
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const checkUserGroups = useCallback(async () => {
    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (idToken) {
        const payload = decodeJwtPayload(idToken);
        const groups = (payload["cognito:groups"] as string[]) || [];
        setIsAdmin(groups.includes("admin"));
      }
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const loadUserProfile = useCallback(
    async (username: string, email?: string): Promise<AuthUser> => {
      let name: string | undefined;
      let company: string | undefined;
      let phone: string | undefined;
      let preferences = { ...DEFAULT_PREFERENCES };

      try {
        const { fetchUserAttributes } = await import("aws-amplify/auth");
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
    [],
  );

  const checkAuth = useCallback(async () => {
    try {
      const { getCurrentUser } = await import("aws-amplify/auth");
      const currentUser = await getCurrentUser();
      const email = currentUser.signInDetails?.loginId;
      const profile = await loadUserProfile(currentUser.username, email);
      setUser(profile);
      await checkUserGroups();
    } catch {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [checkUserGroups, loadUserProfile]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      let ok: boolean;
      try {
        const { configureAmplify } = await import("@/lib/amplify-config");
        ok = configureAmplify();
      } catch (err) {
        if (!cancelled) {
          console.error("Amplify configuration failed:", err);
          setConfigError(
            err instanceof Error
              ? err.message
              : "Authentication configuration failed",
          );
          setIsLoading(false);
        }
        return;
      }
      if (!ok) {
        if (!cancelled) {
          setConfigError(
            "Authentication is not configured for this environment.",
          );
          setIsLoading(false);
        }
        return;
      }
      checkAuth();
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [checkAuth]);

  const handleSignIn = async (
    email: string,
    password: string,
  ): Promise<SignInResult> => {
    const { signIn: amplifySignIn, signOut: amplifySignOut } = await import(
      "aws-amplify/auth"
    );
    try {
      const result = await amplifySignIn({ username: email, password });

      if (
        result.nextStep?.signInStep ===
        "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
      ) {
        return { needsNewPassword: true };
      }

      if (result.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
        return { needsConfirmation: true };
      }

      if (result.isSignedIn) {
        await checkAuth();
      }
      return {};
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "UserAlreadyAuthenticatedException"
      ) {
        await amplifySignOut();
        const result = await amplifySignIn({ username: email, password });
        if (result.isSignedIn) {
          await checkAuth();
        }
        return {};
      }
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleSignUp = async (
    email: string,
    password: string,
    name?: string,
  ) => {
    const { signUp: amplifySignUp } = await import("aws-amplify/auth");
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
    const { signOut: amplifySignOut } = await import("aws-amplify/auth");
    await amplifySignOut();
    setUser(null);
    setIsAdmin(false);
  };

  const handleConfirmSignUp = async (email: string, code: string) => {
    const { confirmSignUp: amplifyConfirmSignUp } = await import(
      "aws-amplify/auth"
    );
    try {
      await amplifyConfirmSignUp({ username: email, confirmationCode: code });
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleForgotPassword = async (email: string) => {
    const { resetPassword: amplifyResetPassword } = await import(
      "aws-amplify/auth"
    );
    try {
      await amplifyResetPassword({ username: email });
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleConfirmForgotPassword = async (
    email: string,
    code: string,
    newPassword: string,
  ) => {
    const { confirmResetPassword: amplifyConfirmResetPassword } = await import(
      "aws-amplify/auth"
    );
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
    const { confirmSignIn: amplifyConfirmSignIn } = await import(
      "aws-amplify/auth"
    );
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
      const updates: Record<string, string> = {};
      if (attrs.name !== undefined) updates.name = attrs.name;
      if (attrs.phone !== undefined) updates.phone_number = attrs.phone;
      if (attrs.company !== undefined)
        updates["custom:company"] = attrs.company;

      if (Object.keys(updates).length > 0) {
        const { updateUserAttributes } = await import("aws-amplify/auth");
        await updateUserAttributes({ userAttributes: updates });
      }

      setUser((prev) =>
        prev
          ? {
              ...prev,
              name: attrs.name ?? prev.name,
              company: attrs.company ?? prev.company,
              phone: attrs.phone ?? prev.phone,
            }
          : prev,
      );
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
      const { updateUserAttributes } = await import("aws-amplify/auth");
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
