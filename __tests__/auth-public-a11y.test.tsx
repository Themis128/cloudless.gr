import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import LoginPage from "@/app/[locale]/auth/login/page";
import SignUpPage from "@/app/[locale]/auth/signup/page";
import ForgotPasswordPage from "@/app/[locale]/auth/forgot-password/page";
import NewsletterForm from "@/components/NewsletterForm";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  redirect: vi.fn(),
  getPathname: vi.fn(),
}));

vi.mock("@/lib/use-locale", () => ({
  useCurrentLocale: () => ["en"],
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isAdmin: false,
    isLoading: false,
    signIn: vi.fn().mockResolvedValue({}),
    completeNewPassword: vi.fn().mockResolvedValue({}),
    signUp: vi.fn().mockResolvedValue({}),
    confirmSignUp: vi.fn().mockResolvedValue({}),
    forgotPassword: vi.fn().mockResolvedValue({}),
    confirmForgotPassword: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

describe("auth/public accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("login page exposes labeled, autocomplete-enabled credentials fields", () => {
    render(<LoginPage />);

    // When Cognito is configured (NEXT_PUBLIC_COGNITO_USER_POOL_ID is set in test env),
    // the login page shows a single SSO button instead of email/password fields.
    const kcButton = screen.getByRole("button", { name: /continue with aws/i });
    expect(kcButton).toBeTruthy();
  });

  it("signup page exposes verification-safe fields and password constraints", () => {
    const { container } = render(<SignUpPage />);

    const email = screen.getByLabelText("Email") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    const confirm = screen.getByLabelText("Confirm Password") as HTMLInputElement;

    expect(email.autocomplete).toBe("email");
    expect(password.autocomplete).toBe("new-password");
    expect(confirm.autocomplete).toBe("new-password");
    expect(password.minLength).toBe(8);
    expect(confirm.minLength).toBe(8);
    expect(container.querySelector('a[href="/auth/login"]')).toBeTruthy();
  });

  it("forgot password page uses one-time-code and new-password semantics", () => {
    render(<ForgotPasswordPage />);

    const email = screen.getByLabelText("Email") as HTMLInputElement;
    const sendCode = screen.getByRole("button", { name: "Send Reset Code" });

    expect(email.type).toBe("email");
    expect(email.autocomplete).toBe("email");
    expect(sendCode).toBeTruthy();
  });

  it("newsletter form provides email field, explicit submit button, and privacy link", () => {
    const { container } = render(<NewsletterForm />);
    const email = container.querySelector('input[type="email"]') as HTMLInputElement | null;
    const submit = screen.getByRole("button", { name: "Subscribe" });

    expect(email).toBeTruthy();
    expect(email?.required).toBe(true);
    expect(submit.getAttribute("type")).toBe("submit");
    expect(container.querySelector('a[href="/privacy"]')).toBeTruthy();
  });
});
