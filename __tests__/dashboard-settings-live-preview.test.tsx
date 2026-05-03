import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useAuth } from "@/context/AuthContext";

// next/link is fine in jsdom; only the locale + auth hooks need mocking.
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
    const SettingsPage = (await import(
      "@/app/[locale]/dashboard/settings/page"
    )).default;
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Light \(Default\)|^Light$/i }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("dispatches the cloudless:theme-pref event so the navbar switcher reacts", async () => {
    const handler = vi.fn();
    window.addEventListener(PREF_EVENT, handler);

    const SettingsPage = (await import(
      "@/app/[locale]/dashboard/settings/page"
    )).default;
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /^System$/i }));
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(PREF_EVENT, handler);
  });

  it("does NOT call updatePreferences until the Save button is clicked", async () => {
    const auth = authMock("dark");
    useAuthMock.mockReturnValue(auth);

    const SettingsPage = (await import(
      "@/app/[locale]/dashboard/settings/page"
    )).default;
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /^Light$/i }));
    expect(auth.updatePreferences).not.toHaveBeenCalled();
  });
});
