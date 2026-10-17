/**
 * Residual branches of the postiz admin page, complementing
 * admin-postiz-interactions.test.tsx: loading states while the first
 * requests are pending, payloads missing their list keys, metrics with no
 * data points, bulk edge cases (deselect, non-JSON 207, error without a
 * message, rejected fetch, invalid interval), AI draft prompt/result
 * fallbacks, an empty or rejected file pick, a failed delete, calendar labels for posts
 * without a providerIdentifier, and the slack/telegram provider settings.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const intg = (id: string, identifier: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `${identifier} chan`,
  identifier,
  providerIdentifier: identifier,
  profile: "p",
  disabled: false,
  ...extra,
});

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Route = [string, string, (() => Response | Promise<Response>) | Response];
let routes: Route[] = [];
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  const method = init?.method ?? "GET";
  for (const [m, frag, out] of routes) {
    if (url.includes(frag) && method === m) return typeof out === "function" ? out() : out;
  }
  return okJson({}, 404);
});

import AdminPostizPage from "@/app/[locale]/admin/postiz/page";

const INTEGRATIONS = [intg("i-x", "x"), intg("i-sl", "slack"), intg("i-tg", "telegram")];

function baseRoutes(extra: Route[] = []) {
  routes = [
    ...extra,
    ["GET", "postiz/integrations", okJson({ integrations: INTEGRATIONS })],
    ["GET", "postiz/posts", okJson({ posts: [] })],
  ];
}

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<AdminPostizPage />).container;
  });
  return c!;
}
const click = async (el: Element | null) => {
  await act(async () => {
    fireEvent.click(el!);
  });
};
const callsTo = (frag: string, method = "GET") =>
  fetchMock.mock.calls.filter(
    ([u, i]) => String(u).includes(frag) && (i?.method ?? "GET") === method
  );
const bodyOf = (frag: string, method = "POST") =>
  JSON.parse(String(callsTo(frag, method).at(-1)![1]!.body));

async function fillBulk(lines: string, ...channels: RegExp[]) {
  await click(screen.getByText("bulk"));
  for (const ch of channels) await click(screen.getByText(ch));
  fireEvent.change(document.getElementById("postiz-bulk-lines")!, { target: { value: lines } });
  fireEvent.change(document.getElementById("postiz-bulk-start")!, {
    target: { value: "2026-11-01T09:00" },
  });
}

beforeEach(() => {
  baseRoutes();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetchMock.mockClear();
});

describe("postiz — loading and sparse payloads", () => {
  it("every tab shows its loading state while the first requests are pending", async () => {
    routes = [
      ["GET", "postiz/integrations", () => new Promise<Response>(() => {})],
      ["GET", "postiz/posts", () => new Promise<Response>(() => {})],
    ];
    const c = await renderPage();
    for (const [tab, text] of [
      ["channels", "Loading channels…"],
      ["analytics", "Loading channels…"],
      ["schedule", "Loading…"],
    ] as const) {
      await click(screen.getByText(tab));
      expect(c.textContent).toContain(text);
    }
    // bulk and calendar render with no integrations/posts yet
    await click(screen.getByText("bulk"));
    expect(c.textContent).toContain("Channels (0 selected)");
    await click(screen.getByText("calendar"));
    expect(c.querySelectorAll("[title]")).toHaveLength(0);
  });

  it("integrations/posts payloads without their list keys render as empty", async () => {
    routes = [
      ["GET", "postiz/integrations", okJson({})],
      ["GET", "postiz/posts", okJson({})],
    ];
    const c = await renderPage();
    await click(screen.getByText("channels"));
    expect(c.textContent).toContain("No channels connected yet");
    await click(screen.getByText("schedule"));
    expect(c.textContent).toContain("No posts in the current window");
  });

  it("analytics: a missing metrics key is empty; metrics without points show dashes", async () => {
    baseRoutes([["GET", "postiz/analytics", okJson({})]]);
    const c = await renderPage();
    await click(screen.getByText("analytics"));
    await click(screen.getByText("Load metrics"));
    expect(c.textContent).toContain("No metrics for this channel/window");

    routes.unshift([
      "GET",
      "postiz/analytics",
      okJson({ metrics: [{ label: "Reach", data: [], percentageChange: 0 }] }),
    ]);
    await click(screen.getByText("Load metrics"));
    const row = screen.getByText("Reach").closest("li")!;
    expect(row.textContent).toContain("latest — · 0 points");
    expect(row.querySelector(".font-mono")!.textContent).toBe("—");
  });

  it("analytics: a channel with no id is never seeded, so Load metrics stays disabled", async () => {
    baseRoutes([["GET", "postiz/integrations", okJson({ integrations: [intg("", "x")] })]]);
    await renderPage();
    await click(screen.getByText("analytics"));
    const btn = screen.getByText("Load metrics") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await click(btn);
    expect(callsTo("postiz/analytics")).toHaveLength(0);
  });
});

describe("postiz — bulk edge cases", () => {
  it("deselecting a channel removes it from the bulk payload", async () => {
    baseRoutes([["POST", "postiz/posts/bulk", okJson({ succeeded: 1, failed: 0 })]]);
    await renderPage();
    await fillBulk("one", /x chan/, /slack chan/);
    expect(screen.getByText("Channels (2 selected)")).toBeTruthy();
    await click(screen.getByText(/slack chan/));
    expect(screen.getByText("Channels (1 selected)")).toBeTruthy();
    await click(screen.getByText("Schedule all"));
    expect(
      bodyOf("postiz/posts/bulk").items[0].posts.map(
        (p: { integration: { id: string } }) => p.integration.id
      )
    ).toEqual(["i-x"]);
  });

  it("a non-JSON 207 reports zero counts and stays on the bulk tab", async () => {
    baseRoutes([["POST", "postiz/posts/bulk", new Response("partial", { status: 207 })]]);
    const c = await renderPage();
    await fillBulk("one", /x chan/);
    await click(screen.getByText("Schedule all"));
    expect(c.textContent).toContain("✅ Bulk done — 0 ok, 0 failed");
    expect(screen.getByText("Schedule all")).toBeTruthy();
  });

  it("a failure without an error message shows just the status", async () => {
    baseRoutes([["POST", "postiz/posts/bulk", okJson({}, 500)]]);
    const c = await renderPage();
    await fillBulk("one", /x chan/);
    await click(screen.getByText("Schedule all"));
    expect(c.textContent).toContain("Bulk failed: 500 ");
    expect(c.textContent).not.toContain("undefined");
  });

  it("a rejected request re-enables the button without feedback", async () => {
    baseRoutes([["POST", "postiz/posts/bulk", () => Promise.reject(new Error("offline"))]]);
    const c = await renderPage();
    await fillBulk("one", /x chan/);
    await click(screen.getByText("Schedule all"));
    const btn = screen.getByText("Schedule all") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(c.textContent).not.toContain("Bulk");
  });

  it("an empty interval falls back to 24h spacing; telegram gets its bare settings", async () => {
    baseRoutes([["POST", "postiz/posts/bulk", okJson({ succeeded: 2, failed: 0 })]]);
    await renderPage();
    await fillBulk("a\nb", /telegram chan/);
    fireEvent.change(document.getElementById("postiz-bulk-interval")!, { target: { value: "" } });
    expect((document.getElementById("postiz-bulk-interval") as HTMLInputElement).value).toBe("24");
    await click(screen.getByText("Schedule all"));
    const items = bodyOf("postiz/posts/bulk").items;
    expect(new Date(items[1].date).getTime() - new Date(items[0].date).getTime()).toBe(
      24 * 3600 * 1000
    );
    expect(items[0].posts[0].settings).toEqual({ __type: "telegram" });
  });
});

describe("postiz — compose fallbacks", () => {
  it("AI draft with no channel or content uses the generic prompt; no result keeps the text", async () => {
    baseRoutes([["POST", "ai/generate", okJson({})]]);
    await renderPage();
    await click(screen.getByText("AI draft"));
    const { prompt } = bodyOf("ai/generate");
    expect(prompt).toContain("Write one concise social media post for social media.");
    expect(prompt).toContain("Topic: cloudless.gr post for social media.");
    expect((document.getElementById("postiz-content") as HTMLTextAreaElement).value).toBe("");
  });

  it("picking no file uploads nothing", async () => {
    await renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [] } });
    });
    expect(callsTo("postiz/upload-file", "POST")).toHaveLength(0);
  });

  it("a rejected file upload is swallowed and adds no media", async () => {
    baseRoutes([["POST", "postiz/upload-file", () => Promise.reject(new Error("offline"))]]);
    const c = await renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(["x"], "f.png", { type: "image/png" })] },
      });
    });
    expect(callsTo("postiz/upload-file", "POST")).toHaveLength(1);
    expect(c.textContent).toContain("Media (0)");
  });

  it("slack provider settings use the Slack channel-id placeholder", async () => {
    await renderPage();
    await click(screen.getByText(/slack chan/));
    await click(screen.getByText(/Provider-specific settings/));
    expect(screen.getByPlaceholderText("C0123ABCDE")).toBeTruthy();
    expect(screen.queryByPlaceholderText("#general or channel id")).toBeNull();
  });
});

describe("postiz — schedule and calendar", () => {
  const scheduled = (id: string, integration: Record<string, unknown>) => ({
    id,
    content: `content ${id}`,
    publishDate: "2026-11-15T10:00:00.000Z",
    state: "QUEUE",
    integration,
  });

  it("a failed delete does not reload the posts", async () => {
    baseRoutes([
      ["DELETE", "postiz/posts", new Response("nope", { status: 500 })],
      ["GET", "postiz/posts", okJson({ posts: [scheduled("p1", intg("i-x", "x"))] })],
    ]);
    await renderPage();
    await click(screen.getByText("schedule"));
    const before = callsTo("postiz/posts").length;
    await click(screen.getByText("Delete"));
    expect(callsTo("postiz/posts/p1", "DELETE")).toHaveLength(1);
    expect(callsTo("postiz/posts").length).toBe(before);
  });

  it("calendar labels fall back from providerIdentifier to identifier, then to blank", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-05T00:00:00Z"), toFake: ["Date"] });
    baseRoutes([
      [
        "GET",
        "postiz/posts",
        okJson({
          posts: [
            scheduled("a", { id: "i1", name: "n1", identifier: "mastodon" }),
            scheduled("b", { id: "i2", name: "n2" }),
          ],
        }),
      ],
    ]);
    const c = await renderPage();
    await click(screen.getByText("calendar"));
    const labels = Array.from(c.querySelectorAll("[title]")).map((el) => el.textContent);
    expect(labels).toEqual(["mastodon: content a", ": content b"]);
  });
});
