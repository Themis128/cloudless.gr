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
const mockUnregister = vi.fn();
const mockGetRegistrations = vi.fn();
const originalNodeEnv = process.env.NODE_ENV;
const originalSiteHost = process.env.NEXT_PUBLIC_SITE_HOSTNAME;

const setNodeEnv = (value: string | undefined) => {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env.NODE_ENV;
  } else {
    env.NODE_ENV = value;
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRegister.mockResolvedValue({ scope: "/" });
  mockUnregister.mockResolvedValue(true);
  mockGetRegistrations.mockResolvedValue([{ unregister: mockUnregister }]);

  Object.defineProperty(navigator, "serviceWorker", {
    value: { register: mockRegister, getRegistrations: mockGetRegistrations },
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

  delete process.env.NEXT_PUBLIC_SITE_HOSTNAME;
  sessionStorage.clear();
});

afterEach(() => {
  setNodeEnv(originalNodeEnv);
  if (originalSiteHost) {
    process.env.NEXT_PUBLIC_SITE_HOSTNAME = originalSiteHost;
  } else {
    delete process.env.NEXT_PUBLIC_SITE_HOSTNAME;
  }
  cleanup();
});

describe("ServiceWorkerRegistration", () => {
  it("registers the service worker in production on non-local hosts", async () => {
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_SITE_HOSTNAME = "cloudless.gr";

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ServiceWorkerRegistration />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith("/sw.js");
    });
  });

  it("does not register and unregisters existing workers on localhost", async () => {
    setNodeEnv("production");

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ServiceWorkerRegistration />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(mockGetRegistrations).toHaveBeenCalledTimes(1);
      expect(mockUnregister).toHaveBeenCalledTimes(1);
    });
    expect(mockRegister).not.toHaveBeenCalled();
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
    expect(notNowBtn).toBeTruthy();
    fireEvent.click(notNowBtn!);

    const prompt = container.querySelector('[class*="text-white"]');
    expect(
      prompt === null || !prompt.textContent?.includes("Stay updated"),
    ).toBe(true);
    expect(sessionStorage.getItem("cloudless-push-dismissed")).toBe("1");
  });
});
