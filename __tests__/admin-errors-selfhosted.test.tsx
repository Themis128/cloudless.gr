/**
 * admin/errors (Sentry issue list + resolve/ignore + level filters) and
 * admin/selfhosted (Kuma health mapping + autologin open).
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let routes: Record<string, unknown> = {};
const fetchWithAuthMock = vi.fn(async (url: string, init?: RequestInit) => {
  const match = Object.keys(routes)
    .sort((a, b) => b.length - a.length)
    .find((k) => String(url).startsWith(k));
  const out = match ? routes[match] : undefined;
  if (typeof out === "function") return out(String(url), init);
  if (out instanceof Response) return out.clone();
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...(args as [string, RequestInit?])),
}));
vi.mock("@/components/admin/InsightPanel", () => ({
  InsightPanel: () => <div data-testid="insight-panel" />,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import AdminErrorsPage from "@/app/[locale]/admin/errors/page";
import SelfhostedPage from "@/app/[locale]/admin/selfhosted/page";

const click = async (el: Element) => {
  await act(async () => fireEvent.click(el));
};
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const renderPage = async (el: React.JSX.Element) => {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(el).container;
  });
  return c!;
};

beforeEach(() => {
  routes = {};
  fetchWithAuthMock.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("admin/errors", () => {
  const issues = [
    {
      id: "i1",
      title: "TypeError: x is null",
      culprit: "src/foo.ts",
      level: "error",
      count: "42",
      firstSeen: "2026-01-01T00:00:00Z",
      lastSeen: "2026-01-02T00:00:00Z",
      status: "unresolved",
    },
    {
      id: "i2",
      title: "Slow query",
      culprit: "src/db.ts",
      level: "warning",
      count: "3",
      firstSeen: "2026-01-01T00:00:00Z",
      lastSeen: "2026-01-02T00:00:00Z",
      status: "unresolved",
    },
  ];

  it("list + counts + filter + resolve removes issue", async () => {
    routes["/api/admin/ops/errors"] = (u: string, init?: RequestInit) => {
      if (init?.method === "PUT") return okJson({});
      return okJson({ issues });
    };
    const c = await renderPage(<AdminErrorsPage />);
    expect(c.textContent).toContain("TypeError: x is null");
    expect(c.textContent).toContain("45"); // total events 42+3

    // filter to warning → only Slow query
    await click(screen.getByText("warning (1)"));
    expect(c.textContent).not.toContain("TypeError");
    expect(c.textContent).toContain("Slow query");
    await click(screen.getByText("all (2)"));

    // resolve i1 → PUT + removed from list
    await click(screen.getAllByText("✓ Resolve")[0]);
    const put = fetchWithAuthMock.mock.calls.find(
      ([u, i]) => i?.method === "PUT" && String(u).includes("/i1")
    );
    expect(JSON.parse(String(put![1].body))).toEqual({ status: "resolved" });
    expect(c.textContent).not.toContain("TypeError");
    expect(c.textContent).toContain("Resolved successfully");
  });

  it("action error message + 503 + empty", async () => {
    routes["/api/admin/ops/errors"] = (u: string, init?: RequestInit) =>
      init?.method === "PUT" ? okJson({ error: "nope" }, 400) : okJson({ issues });
    const c = await renderPage(<AdminErrorsPage />);
    await click(screen.getAllByText("⊘ Ignore")[0]);
    await flush();
    expect(c.textContent).toContain("nope");

    routes["/api/admin/ops/errors"] = okJson({}, 503);
    cleanup();
    const c2 = await renderPage(<AdminErrorsPage />);
    expect(c2.textContent).toContain("Sentry not configured");

    routes["/api/admin/ops/errors"] = okJson({ issues: [] });
    cleanup();
    const c3 = await renderPage(<AdminErrorsPage />);
    expect(c3.textContent).toContain("All Clear");
  });
});

describe("admin/selfhosted", () => {
  it("renders 6 app cards + kuma health + autologin open", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    routes["/api/admin/cluster/kuma-status"] = okJson({
      summary: {
        monitors: [
          { id: 1, name: "EspoCRM", status: "up", pingMs: 12, lastHeartbeatAt: null, groupName: "" },
          { id: 2, name: "n8n-main", status: "down", pingMs: null, lastHeartbeatAt: null, groupName: "" },
          { id: 3, name: "unmatched", status: "up", pingMs: 5, lastHeartbeatAt: null, groupName: "" },
        ],
      },
    });
    routes["/api/admin/autologin"] = okJson({ url: "https://espo.example/login?token=x" });
    const c = await renderPage(<SelfhostedPage />);
    expect(c.textContent).toContain("EspoCRM");
    expect(c.textContent).toContain("AppFlowy");
    expect(c.textContent).toContain("Uptime Kuma");
    expect(c.textContent).toContain("1 app(s) down"); // n8n down → badge
    expect(c.textContent).toContain("12ms"); // ping on up monitor

    // autologin → window.open with returned url
    await click(screen.getAllByText("Open →")[0]);
    const call = fetchWithAuthMock.mock.calls.find(([u]) =>
      String(u).includes("autologin")
    );
    expect(call).toBeDefined();
    expect(openSpy).toHaveBeenCalledWith(
      "https://espo.example/login?token=x",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("autologin error + kuma failure → silent", async () => {
    routes["/api/admin/cluster/kuma-status"] = okJson({}, 500);
    routes["/api/admin/autologin"] = okJson({ error: "no creds" }, 500);
    const c = await renderPage(<SelfhostedPage />);
    await click(screen.getAllByText("Open →")[0]);
    await flush();
    expect(c.textContent).toContain("no creds");
  });
});
