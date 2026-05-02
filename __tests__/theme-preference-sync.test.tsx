import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ThemePreferenceSync from "@/components/ThemePreferenceSync";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const usePathnameMock = vi.mocked(usePathname);
const useAuthMock = vi.mocked(useAuth);

describe("ThemePreferenceSync", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "dark");

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("uses route theme when no user preference exists", async () => {
    usePathnameMock.mockReturnValue("/en/services");
    useAuthMock.mockReturnValue({ user: null } as never);

    render(<ThemePreferenceSync />);

    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  it("applies saved user preference on non-admin routes", async () => {
    usePathnameMock.mockReturnValue("/en/dashboard");
    useAuthMock.mockReturnValue({
      user: { preferences: { theme: "light" } },
    } as never);

    render(<ThemePreferenceSync />);

    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  it("forces dark theme on admin routes even if user preference is light", async () => {
    usePathnameMock.mockReturnValue("/en/admin/orders");
    useAuthMock.mockReturnValue({
      user: { preferences: { theme: "light" } },
    } as never);

    render(<ThemePreferenceSync />);

    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
  });
});
