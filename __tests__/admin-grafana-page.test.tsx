/**
 * Populated tests for the Grafana admin page — dashboard grid, health chip
 * states, unconfigured warning, empty inventory, and load errors.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const fetchMock = vi.fn();
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchMock(...args),
}));

import GrafanaAdminPage from "@/app/[locale]/admin/grafana/page";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

function route(dashboards: unknown, health: unknown, dashboardsStatus = 200) {
  fetchMock.mockImplementation((url: string) =>
    url.includes("/health")
      ? Promise.resolve(okJson(health))
      : Promise.resolve(
          new Response(JSON.stringify(dashboards), {
            status: dashboardsStatus,
            headers: { "Content-Type": "application/json" },
          })
      )
  );
}

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<GrafanaAdminPage />).container;
  });
  return c!;
}

describe("admin grafana — populated", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("renders dashboard cards with folder, tags, and OK health chip", async () => {
    route(
      {
        configured: true,
        dashboards: [
          {
            uid: "abc",
            title: "Node Exporter",
            url: "/d/abc/node",
            type: "dash-db",
            tags: ["infra", "k3s"],
            folderTitle: "Cluster",
          },
          {
            uid: "def",
            title: "App Latency",
            url: "/d/def/latency",
            type: "dash-db",
            tags: [],
          },
        ],
      },
      { configured: true, healthy: true }
    );
    const c = await renderPage();
    expect(c.textContent).toContain("Node Exporter");
    expect(c.textContent).toContain("App Latency");
    expect(c.textContent).toContain("Cluster");
    expect(c.textContent).toContain("infra, k3s");
    expect(c.textContent).toContain("General"); // missing folderTitle fallback
    expect(c.textContent).toContain("OK");
    const link = c.querySelector('a[href="https://grafana.cloudless.gr/d/abc/node"]');
    expect(link).not.toBeNull();
  });

  it("shows the unconfigured warning when the token is missing", async () => {
    route({ configured: false, dashboards: [] }, { configured: false, healthy: false }, 503);
    const c = await renderPage();
    expect(c.textContent).toContain("GRAFANA_API_TOKEN");
    expect(c.textContent).toContain("UNCONFIGURED");
  });

  it("shows the empty-inventory hint when configured with no dashboards", async () => {
    route({ configured: true, dashboards: [] }, { configured: true, healthy: false });
    const c = await renderPage();
    expect(c.textContent).toContain("no dashboards exist yet");
    expect(c.textContent).toContain("UNREACHABLE");
  });

  it("renders the thrown error on a non-503 dashboards failure", async () => {
    route({ configured: true, dashboards: [] }, { configured: true, healthy: true }, 500);
    const c = await renderPage();
    expect(c.textContent).toContain("dashboards HTTP 500");
  });
});
