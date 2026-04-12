import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import rawMessages from "../src/locales/en.json";

const messages = rawMessages as unknown as AbstractIntlMessages;
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";

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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  redirect: vi.fn(),
  getPathname: vi.fn(),
}));

const mockRegister = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  const mockRegistration = {
    scope: "/",
    waiting: null,
    installing: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  mockRegister.mockResolvedValue(mockRegistration);

  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      register: mockRegister,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      ready: Promise.resolve(mockRegistration),
      controller: null,
    },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, "Notification", {
    value: {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    },
    writable: true,
    configurable: true,
  });

  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("ServiceWorkerRegistration", () => {
  it("registers the service worker on mount", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ServiceWorkerRegistration />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith("/sw.js");
    });
  });
});

describe("PushNotificationPrompt", () => {
  it("shows prompt on 2nd visit", async () => {
    sessionStorage.setItem("cloudless-visits", "1");

    render(<PushNotificationPrompt />);

    await waitFor(() => {
      expect(screen.getByText(/Stay updated/)).toBeTruthy();
    });
  });

  it("hides when dismissed", async () => {
    sessionStorage.setItem("cloudless-visits", "1");

    const { container } = render(<PushNotificationPrompt />);

    await waitFor(() => {
      const el = container.querySelector('[class*="text-white"]');
      expect(el?.textContent).toMatch(/Stay updated/);
    });

    const buttons = container.querySelectorAll("button");
    const notNowBtn = Array.from(buttons).find((b) =>
      b.textContent?.includes("Not now"),
    );
    expect(not