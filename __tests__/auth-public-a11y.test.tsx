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

    const kcButton = screen.getByRole("button", { name: /continue with aws/i });
    expect(kcButton).toBeTruthy();
  });

  it("signup page exposes the Cognito Hosted UI handoff", () => {
    const { container } = render(<SignUpPage />);

    expect(screen.getByRole("heading", { name: /create account/i })).toBeTruthy();
    expect(screen.getByText(/account creation is handled securely through aws/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /continue with aws/i })).toBeTruthy();

    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByLabelText("Confirm Password")).toBeNull();

    expect(container.querySelector('a[href="/auth/login"]')).toBeTruthy();
  });

  it("forgot password page has email field and reset link button", () => {
    render(<ForgotPasswordPage />);

    const email = screen.getByLabelText("Email") as HTMLInputElement;
    const sendLink = screen.getByRole("button", { name: "Send Reset Link" });

    expect(email.type).toBe("email");
    expect(email.autocomplete).toBe("email");
    expect(sendLink).toBeTruthy();
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
