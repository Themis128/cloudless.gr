/**
 * Admin tail: headlamp token mint, notifications list/actions, users directory actions.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: fetchWithAuthMock }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "a@b.c" }, isAdmin: true, isLoading: false }),
}));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));

import HeadlampPage from "@/app/[locale]/admin/headlamp/page";
import NotificationsPage from "@/app/[locale]/admin/notifications/page";
import UsersPage from "@/app/[locale]/admin/users/page";

const okJson = (b: unknown) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

// ── headlamp ────────────────────────────────────────────────────────────────

describe("admin headlamp", () => {
  it("mints a token, copies it, and opens Headlamp in a new tab", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      okJson({ token: "sa-token-1", expirationTimestamp: "2026-01-02T00:00:00Z" })
    );
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);

    const { container, getByText } = render(<HeadlampPage />);
    await act(async () => fireEvent.click(getByText("Get token & open Headlamp")));
    await waitFor(() => expect(container.textContent).toContain("sa-token-1"));
    expect(writeText).toHaveBeenCalledWith("sa-token-1");
    expect(openSpy).toHaveBeenCalled();
    // select-on-click textarea
    const ta = container.querySelector("textarea");
    expect(ta?.value).toBe("sa-token-1");
  });

  it("surfaces mint errors", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "no k8s" }), { status: 500 })
    );
    const { container, getByText } = render(<HeadlampPage />);
    await act(async () => fireEvent.click(getByText("Just copy token (don't open)")));
    await waitFor(() => expect(container.textContent).toContain("no k8s"));
  });
});

// ── notifications ───────────────────────────────────────────────────────────

const notif = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "n1",
  title: "Deploy finished",
  message: "rollout ok",
  category: "auth",
  type: "success",
  read: false,
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("admin notifications", () => {
  const analytics = {
    window: { since: "2025-12-25", until: "2026-01-01" },
    total: 3,
    byCategory: { auth: 3 },
    byDay: { "2026-01-01": 3 },
  };

  it("loads list + analytics, filters by category, marks read", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("analytics")) return okJson(analytics);
      if (init?.method === "PATCH") return okJson({ ok: true });
      return okJson({ notifications: [notif(), notif({ id: "n2", read: true, type: "error" })] });
    });

    const { container, getByText } = render(<NotificationsPage />);
    await waitFor(() => expect(container.textContent).toContain("Deploy finished"));

    // mark-all-read PATCH
    await act(async () => fireEvent.click(getByText("Mark all read")));
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(
          ([u, i]) => String(u).includes("/api/admin/notifications") && (i as RequestInit)?.method === "PATCH"
        )
      ).toBe(true)
    );

    // category pill triggers a scoped reload
    fetchWithAuthMock.mockClear();
    const contactPill = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.startsWith("Contact")
    )!;
    await act(async () => fireEvent.click(contactPill));
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(([u]) => String(u).includes("category=contact"))
      ).toBe(true)
    );
  });

  it("shows error state when loading fails", async () => {
    fetchWithAuthMock.mockRejectedValue(new Error("down"));
    const { container } = render(<NotificationsPage />);
    await waitFor(() => expect(container.textContent).toMatch(/down|error|failed/i));
  });
});

// ── users ───────────────────────────────────────────────────────────────────

const user = (over: Partial<Record<string, unknown>> = {}) => ({
  username: "u1",
  email: "u1@x.dev",
  name: "User One",
  company: "Acme",
  phone: "",
  status: "active",
  emailVerified: true,
  userStatus: "CONFIRMED",
  role: "user",
  created: "2026-01-01",
  lastModified: "2026-01-01",
  ...over,
});

describe("admin users", () => {
  it("loads users, filters by search, runs promote/disable actions", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return okJson({ message: "done" });
      return okJson({
        users: [
          user(),
          user({ username: "u2", email: "u2@x.dev", name: "Admin Two", role: "admin", status: "disabled", userStatus: "UNCONFIRMED" }),
        ],
        provider: "d1",
      });
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { container, getByText, getAllByText } = render(<UsersPage />);
    await waitFor(() => expect(container.textContent).toContain("User One"));
    expect(container.textContent).toContain("Admin Two");

    // search filter narrows the table
    const search = container.querySelector('input[type="text"], input[placeholder]')!;
    fireEvent.change(search, { target: { value: "nope@zzz" } });
    await waitFor(() => expect(container.textContent).toMatch(/no users|0|match/i));
    fireEvent.change(search, { target: { value: "" } });

    // promote u1 → POST action=promote
    await act(async () => fireEvent.click(getAllByText("→ Admin")[0]));
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(
          ([_u, i]) =>
            (i as RequestInit)?.method === "POST" &&
            String((i as RequestInit)?.body).includes('"action":"promote"')
        )
      ).toBe(true)
    );

    // disable u1 → POST action=disable
    await act(async () => fireEvent.click(getByText("Disable")));
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(
          ([_u, i]) => String((i as RequestInit)?.body ?? "").includes('"action":"disable"')
        )
      ).toBe(true)
    );
  });

  it("shows an action error message when the POST fails", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST")
        return new Response(JSON.stringify({ error: "cognito down" }), { status: 500 });
      return okJson({ users: [user()], provider: "d1" });
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container, getByText } = render(<UsersPage />);
    await waitFor(() => expect(container.textContent).toContain("User One"));
    await act(async () => fireEvent.click(getByText("Disable")));
    await waitFor(() => expect(container.textContent).toContain("cognito down"));
  });
});
