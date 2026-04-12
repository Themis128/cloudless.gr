import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import messagesRaw from "../src/locales/en.json";
import LocaleSwitcher from "@/components/LocaleSwitcher";

const messages = messagesRaw as unknown as AbstractIntlMessages;

// Track router.replace calls
const mockReplace = vi.fn();

// Mock next/navigation (no real Next.js App Router in jsdom)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

// Provide i18n navigation adapter (createNavigation needs App Router which doesn't exist in jsdom)
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={typeof href === "string" ? href : "/"} {...props}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, refresh: vi.fn() }),
  usePathname: () => "/",
  redirect: vi.fn(),
  getPathname: vi.fn(),
}));

describe("LocaleSwitcher component", () => {
  afterEach(() => {
    cleanup();
    mockReplace.mockClear();
  });

  beforeEach(() => {
    // Clear cookies before each test
    const cookies = document.cookie.split(";");
    cookies.forEach((c) => {
      const cookieName = c.split("=")[0].trim();
      document.cookie = `${cookieName}=;expires=${new Date(0).toUTCString()};path=/`;
    });
  });

  function renderSwitcher() {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LocaleSwitcher />
      </NextIntlClientProvider>,
    );
  }

  function getToggleButton() {
    return screen.getByRole("button", { name: /Language:.*Click to change/i });
  }

  async function openDropdown() {
    const btn = getToggleButton();
    await act(async () => {
      fireEvent.click(btn);
    });
  }

  it("renders with current locale displayed", () => {
    renderSwitcher();
    expect(getToggleButton()).toBeTruthy();
    // Button shows locale flag code "EN" in collapsed state
    expect(screen.getByText("EN")).toBeTruthy();
  });

  it("opens dropdown and shows all locales on click", async () => {
    renderSwitcher();
    await openDropdown();
    const languages = ["English", "\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac", "Fran\u00e7ais"];
    for (const lang of languages) {
      expect(screen.getByText(lang)).toBeTruthy();
    }
  });

  it("closes dropdown when clicking outside", async () => {
    renderSwitcher();
    await openDropdown();
    expect(screen.getByText("\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac")).toBeTruthy();
    await act(async () => {
      fireEvent.mouseDown(document.body);
    });
    await waitFor(() => {
      expect(screen.queryByText("\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac")).toBeNull();
    });
  });

  it("navigates to new locale when selecting a language", async () => {
    renderSwitcher();
    await openDropdown();
    await act(async () => {
      fireEvent.click(screen.getByText("\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac"));
    });
    // Locale switching now uses router.replace with locale option
    expect(mockReplace).toHaveBeenCalledWith("/", { locale: "el" });
  });

  it("should set correct lang attribute on document", () => {
    document.documentElement.lang = "en";
    renderSwitcher();
    expect(document.documentElement.lang).toBe("en");
  });

  it("toggles dropdown visibility", async () => {
    renderSwitcher();
    // Open
    await openDropdown();
    expect(screen.getByText("\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac")).toBeTruthy();
    // Close
    await act(async () => {
      fireEvent.click(getToggleButton());
    });
    await waitFor(() => {
      expect(screen.queryByText("\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac")).toBeNull();
    });
  });

  it("has accessible button with aria label", () => {
    renderSwitcher();
    const btn = getToggleButton();
    expect(btn.getAttribute("aria-expanded")).toBeDefined();
  });
});
