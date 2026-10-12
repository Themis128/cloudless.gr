import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useAuth } from "@/context/AuthContext";

// Mock @/i18n/navigation so the Link component doesn't need an IntlProvider.
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => "/",
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/use-locale", () => ({
  useCurrentLocale: () => ["en", () => {}],
}));

const useAuthMock = vi.mocked(useAuth);
const STORAGE_KEY = "cloudless-theme-pref";
const PREF_EVENT = "cloudless:theme-pref";

function authMock(initialTheme: "system" | "light" | "dark" = "dark") {
  return {
    user: {
      email: "test@cloudless.gr",
      name: "Test User",
      preferences: {
        theme: initialTheme,
        language: "en",
        emailOrders: true,
        emailNewsletter: false,
        emailMarketing: false,
      },
    },
    updatePreferences: vi.fn().mockResolvedValue(undefined),
    isAdmin: false,
    isLoading: false,
    signOut: vi.fn(),
  } as never;
}

describe("dashboard /settings — theme button live preview", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthMock.mockReturnValue(authMock("dark"));
  });
  afterEach(() => cleanup());

  it("clicking a theme button writes localStorage immediately, before Save", async () => {
    const SettingsPage = (await import("@/app/[locale]/dashboard/settings/page")).default;
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Light \(Default\)|^Light$/i }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("dispatches the cloudless:theme-pref event so the navbar switcher reacts", async () => {
    const handler = vi.fn();
    window.addEventListener(PREF_EVENT, handler);

    const SettingsPage = (await import("@/app/[locale]/dashboard/settings/page")).default;
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /^System$/i }));
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(PREF_EVENT, handler);
  });

  it("does NOT call updatePreferences until the Save button is clicked", async () => {
    const updatePreferences = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      ...(authMock("dark") as { user: unknown }),
      updatePreferences,
    } as never);

    const SettingsPage = (await import("@/app/[locale]/dashboard/settings/page")).default;
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /^Light$/i }));
    expect(updatePreferences).not.toHaveBeenCalled();
  });
});


describe("dashboard /settings — save + toggles", () => {
  afterEach(() => cleanup());

  it("persists preferences via updatePreferences and shows the saved state", async () => {
    const updatePreferences = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({ ...authMock(), updatePreferences });
    const SettingsPage = (await import("@/app/[locale]/dashboard/settings/page")).default;
    render(<SettingsPage />);

    // toggle a checkbox + language, then save
    fireEvent.click(screen.getByRole("button", { name: /Français/i }));
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await vi.waitFor(() => expect(updatePreferences).toHaveBeenCalledTimes(1));
    expect(updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ language: "fr", emailNewsletter: true })
    );
    await vi.waitFor(() =>
      expect(document.body.textContent).toMatch(/saved/i)
    );
  });

  it("shows the error message when updatePreferences rejects", async () => {
    const updatePreferences = vi.fn().mockRejectedValue(new Error("nope"));
    useAuthMock.mockReturnValue({ ...authMock(), updatePreferences });
    const SettingsPage = (await import("@/app/[locale]/dashboard/settings/page")).default;
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("nope")
    );
  });
});
