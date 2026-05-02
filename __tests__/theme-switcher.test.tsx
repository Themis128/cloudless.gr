import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ThemeSwitcher, {
  ThemeSwitcherInline,
} from "@/components/ThemeSwitcher";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/use-locale", () => ({
  useCurrentLocale: () => ["en", () => {}],
}));

const usePathnameMock = vi.mocked(usePathname);
const useAuthMock = vi.mocked(useAuth);

const STORAGE_KEY = "cloudless-theme-pref";

function authMockWith(opts: {
  user?: { preferences?: { theme?: string } } | null;
  updatePreferences?: () => Promise<void>;
}) {
  return {
    user: opts.user ?? null,
    updatePreferences: opts.updatePreferences ?? vi.fn().mockResolvedValue(undefined),
    isAdmin: false,
    isLoading: false,
    signOut: vi.fn(),
  } as never;
}

describe("ThemeSwitcher (popover)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePathnameMock.mockReturnValue("/en");
    useAuthMock.mockReturnValue(authMockWith({}));
  });
  afterEach(() => cleanup());

  it("renders nothing on admin paths", () => {
    usePathnameMock.mockReturnValue("/en/admin/orders");
    const { container } = render(<ThemeSwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it("opens the popover and persists the choice to localStorage", () => {
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("option", { name: /light/i }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("dispatches the cloudless:theme-pref event so other listeners react", () => {
    const handler = vi.fn();
    window.addEventListener("cloudless:theme-pref", handler);
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("option", { name: /dark/i }));
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("cloudless:theme-pref", handler);
  });

  it("calls updatePreferences when an authenticated user picks a theme", () => {
    const updatePreferences = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue(
      authMockWith({
        user: { preferences: { theme: "system" } },
        updatePreferences,
      }),
    );
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("option", { name: /light/i }));
    expect(updatePreferences).toHaveBeenCalledWith({ theme: "light" });
  });

  it("seeds the visible selection from the user's stored preference", () => {
    useAuthMock.mockReturnValue(
      authMockWith({ user: { preferences: { theme: "light" } } }),
    );
    render(<ThemeSwitcher />);
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-label")).toMatch(/Light/i);
  });

  it("localStorage override wins over the user's stored preference", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    useAuthMock.mockReturnValue(
      authMockWith({ user: { preferences: { theme: "light" } } }),
    );
    render(<ThemeSwitcher />);
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-label")).toMatch(/Dark/i);
  });
});

describe("ThemeSwitcherInline", () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePathnameMock.mockReturnValue("/en");
    useAuthMock.mockReturnValue(authMockWith({}));
  });
  afterEach(() => cleanup());

  it("renders three radio options and persists the click", () => {
    render(<ThemeSwitcherInline />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    fireEvent.click(radios[2]); // Dark
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("hides on admin paths", () => {
    usePathnameMock.mockReturnValue("/en/admin");
    const { container } = render(<ThemeSwitcherInline />);
    expect(container.firstChild).toBeNull();
  });
});
