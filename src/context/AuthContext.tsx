"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { configureAmplify } from "@/lib/amplify-config";
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  confirmSignUp as amplifyConfirmSignUp,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
  getCurrentUser,
  fetchAuthSession,
  confirmSignIn as amplifyConfirmSignIn,
  fetchUserAttributes,
  updateUserAttributes,
} from "aws-amplify/auth";

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

/**
 * Map raw Cognito/Amplify error messages to user-friendly strings.
 */
function friendlyAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";

  // Cognito-specific error names
  if (name === "UserAlreadyAuthenticatedException") {
    return "You are already signed in. Redirecting…";
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

  // Fallback: return original message but strip AWS prefix noise
  return message.replace(/^[A-Za-z]+Exception:\s*/, "");
}

const AuthContext = createContext<AuthContextType | null>(null);

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
        const attrs = await fetchUserAttributes();
        name = attrs.name || attrs.given_name || undefined;
        phone = attrs.phone_number || undefined;
        company = attrs["custom:company"] || undefined;

        // Parse preferences from custom attribute
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
    let ok: boolean;
    try {
      ok = configureAmplify();
    } catch (err) {
      console.error("Amplify configuration failed:", err);
      setConfigError(
        err instanceof Error
          ? err.message
          : "Authentication configuration failed",
      );
      setIsLoading(false);
      return;
    }
    if (!ok) {
      setConfigError("Authentication is not configured for this environment.");
      setIsLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const handleSignIn = async (
    email: string,
    password: string,
  ): Promise<SignInResult> => {
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
      // If user is already authenticated, sign out first and retry once
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
      // Re-throw with friendly message
      throw new Error(friendlyAuthError(err));
    }
  };

  const handleSignUp = async (
    email: string,
    password: string,
    name?: string,
  ) => {
    try {
      const userAttributes: Record<string, string> = { email };
      if (name?.trim()) userAttributes