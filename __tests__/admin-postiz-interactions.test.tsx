/**
 * Populated-state interaction tests for the postiz admin page — exercises
 * every tab (compose, bulk, schedule, calendar, channels, analytics), the
 * provider-settings matrix, image add/remove, next-slot, AI draft, and the
 * submit paths (POST/PUT/DELETE) against a routed fetch stub.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/postiz",
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

const post = (id: string, state: string, extra: Record<string, unknown> = {}) => ({
  id,
  content: `content ${id}`,
  publishDate: "2026-11-15T10:00:00.000Z",
  state,
  integration: intg(`i-${id}`, "x"),
  releaseURL: undefined as string | undefined,
  ...extra,
});

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Route table: [method, urlFrag, response-or-fn]. First match wins.
type Route = [string, string, (() => Response) | Response];
let routes: Route[] = [];

const routedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.url;
  const method = init?.method ?? "GET";
  for (const [m, frag, out] of routes) {
    if (url.includes(frag) && method === m) {
      return typeof out === "function" ? out() : out;
    }
  }
  return okJson({}, 404);
};

import AdminPostizPage from "@/app/[locale]/admin/postiz/page";

const INTEGRATIONS = [
  intg("i-x", "x"),
  intg("i-tt", "tiktok"),
  intg("i-yt", "youtube"),
  intg("i-li", "linkedin"),
  intg("i-ig", "instagram"),
  intg("i-dc", "discord"),
  intg("i-fb", "facebook", { disabled: true }),
  intg("i-th", "threads"),
];

const POSTS = [
  post("p-q", "QUEUE"),
  post("p-pub", "PUBLISHED", { releaseURL: "https://x.com/post/1" }),
  post("p-d", "DRAFT"),
  post("p-e", "ERROR"),
];

function defaultRoutes() {
  routes = [
    ["GET", "postiz/integrations", okJson({ integrations: INTEGRATIONS })],
    ["GET", "postiz/posts/bulk", okJson({})],
    ["GET", "postiz/posts", okJson({ posts: POSTS })],
    ["GET", "postiz/analytics", okJson({
      metrics: [
        { label: "Followers", data: [{ total: "10", date: "2026-11-14" }], percentageChange: 12.5 },
        { label: "Likes", data: [{ total: "3", date: "2026-11-14" }], percentageChange: -4.2 },
      ],
    })],
    ["GET", "postiz/slot", okJson({ date: "2026-11-20T09:00:00.000Z" })],
    ["POST", "postiz/upload-file", okJson({ id: "f1", path: "/uploads/f1.png" })],
    ["POST", "postiz/upload", okJson({ id: "u1", path: "/uploads/u1.png" })],
    ["POST", "postiz/posts/bulk", okJson({ succeeded: 2, failed: 0 }, 207)],
    ["POST", "postiz/posts", okJson({})],
    ["POST", "ai/generate", okJson({ result: "AI drafted post text" })],
    ["PUT", "postiz/posts", okJson({})],
    ["DELETE", "postiz/posts", okJson({})],
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

describe("postiz admin — populated interactions", () => {
  beforeEach(() => {
    defaultRoutes();
    vi.stubGlobal("fetch", vi.fn(routedFetch));
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("503 integrations → NotConfigured; channel tab lists integrations with disabled badge", async () => {
    routes = [["GET", "postiz/integrations", new Response("x", { status: 503 })]];
    let c = await renderPage();
    expect(c.textContent).toContain("SocialAuto not configured");
    cleanup();

    defaultRoutes();
    c = await renderPage();
    await click(screen.getByText("channels"));
    expect(c.textContent).toContain("tiktok chan");
    expect(c.textContent).toContain("disabled");
    // refresh button re-fetches
    const callsBefore = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await click(screen.getByText("Refresh"));
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("analytics tab — seeds channel, loads metrics, error + empty paths", async () => {
    const c = await renderPage();
    await click(screen.getByText("analytics"));
    await click(screen.getByText("Load metrics"));
    expect(c.textContent).toContain("Followers");
    expect(c.textContent).toContain("+12.5%");
    expect(c.textContent).toContain("-4.2%");

    // error path
    routes = [["GET", "postiz/analytics", new Response("x", { status: 500 })]];
    await click(screen.getByText("Load metrics"));
    expect(c.textContent).toContain("analytics: 500");

    // empty metrics + lookback change
    routes = [["GET", "postiz/analytics", okJson({ metrics: [] })]];
    fireEvent.change(screen.getByLabelText("Lookback"), { target: { value: "30" } });
    await click(screen.getByText("Load metrics"));
    expect(c.textContent).toContain("No metrics for this channel/window");
  });

  it("compose — toggle channel, upload URL+file, remove image, next slot, AI draft, post now", async () => {
    const c = await renderPage();
    // compose is the default tab; select x channel
    await click(screen.getByText(/x chan/));
    expect(c.textContent).toContain("1 selected");

    // provider settings expand → x reply select
    await click(screen.getByText(/Provider-specific settings/));
    fireEvent.change(screen.getByDisplayValue("Everyone"), {
      target: { value: "mentionedUsers" },
    });

    // content
    fireEvent.change(document.getElementById("postiz-content")!, {
      target: { value: "hello world" },
    });

    // add image by URL
    const urlInput = screen.getByPlaceholderText("https://cloudless.gr/some-image.png");
    fireEvent.change(urlInput, { target: { value: "https://a/b.png" } });
    await click(screen.getByText("Add URL"));
    expect(c.textContent).toContain("u1.png");

    // upload file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, {
        target: { files: [new File(["x"], "f.png", { type: "image/png" })] },
      });
    });
    expect(c.textContent).toContain("f1.png");

    // remove first image
    await click(c.querySelector("li .text-red-600"));

    // next free slot
    await click(screen.getByText("Use next free slot"));
    expect(c.textContent).toContain("Next free slot");

    // AI draft
    await click(screen.getByText("AI draft"));
    expect(c.textContent).toContain("AI drafted post text");

    // post now → POST to /posts → onPosted switches to schedule tab
    await click(screen.getByText("Post now"));
    expect(c.textContent).toContain("content p-q");
    const postCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([u, i]) => String(u).includes("postiz/posts") && i?.method === "POST"
    );
    const body = JSON.parse(String(postCall![1].body));
    expect(body.type).toBe("now");
    expect(body.posts[0].settings.who_can_reply_post).toBe("mentionedUsers");
  });

  it("compose edge cases — no-channel slot, upload failure, submit failure, ai failure", async () => {
    const c = await renderPage();
    await click(screen.getByText("Use next free slot"));
    expect(c.textContent).toContain("Select a channel first");

    await click(screen.getByText(/x chan/));
    routes = [["GET", "postiz/slot", new Response("x", { status: 500 })]];
    await click(screen.getByText("Use next free slot"));
    expect(c.textContent).toContain("Slot lookup failed: 500");

    routes = [["POST", "postiz/upload", new Response("x", { status: 400 })]];
    const urlInput = screen.getByPlaceholderText("https://cloudless.gr/some-image.png");
    fireEvent.change(urlInput, { target: { value: "https://a/b.png" } });
    await click(screen.getByText("Add URL"));
    expect(c.textContent).toContain("Upload failed: 400");

    routes = [["POST", "ai/generate", new Response("x", { status: 503 })]];
    await click(screen.getByText("AI draft"));
    expect(c.textContent).toContain("AI draft failed: 503");

    fireEvent.change(document.getElementById("postiz-content")!, { target: { value: "x" } });
    routes = [["POST", "postiz/posts", new Response("err-body", { status: 422 })]];
    await click(screen.getByText("Post now"));
    expect(c.textContent).toContain("Failed: 422 err-body");
  });

  it("edit flow — schedule tab Edit populates draft, PUT update, cancel", async () => {
    const c = await renderPage();
    await click(screen.getByText("schedule"));
    expect(c.textContent).toContain("content p-q");
    expect(c.textContent).toContain("View published →"); // releaseURL row

    // QUEUE post → Edit → compose tab in edit mode
    await click(screen.getAllByText("Edit")[0]);
    expect(c.textContent).toContain("Editing post");
    expect(c.textContent).toContain("compose (edit)");

    // update schedule (edit id → PUT)
    fireEvent.change(document.getElementById("postiz-schedule")!, {
      target: { value: "2026-12-01T10:00" },
    });
    await click(screen.getByText("Update schedule"));
    const putCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([u, i]) => String(u).includes("postiz/posts/p-q") && i?.method === "PUT"
    );
    expect(putCall).toBeTruthy();
    // onPosted() switches to the schedule tab (feedback unmounts with ComposeTab)
    expect(c.textContent).toContain("content p-q");

    // back to schedule, edit again, cancel
    await click(screen.getByText("schedule"));
    await click(screen.getAllByText("Edit")[0]);
    await click(screen.getByText("Cancel edit"));
    expect(c.textContent).not.toContain("Editing post");
  });

  it("schedule tab — delete with confirm, DRAFT editable, empty list", async () => {
    const c = await renderPage();
    await click(screen.getByText("schedule"));
    // PUBLISHED/ERROR rows have no Edit; DRAFT has one
    expect(screen.getAllByText("Edit")).toHaveLength(2); // QUEUE + DRAFT

    (globalThis.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    await click(screen.getAllByText("Delete")[0]);
    expect(
      (fetch as ReturnType<typeof vi.fn>).mock.calls.some(([, i]) => i?.method === "DELETE")
    ).toBe(false);

    await click(screen.getAllByText("Delete")[0]);
    const delCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([u, i]) => String(u).includes("p-q") && i?.method === "DELETE"
    );
    expect(delCall).toBeTruthy();

    // empty posts
    routes = [["GET", "postiz/posts", okJson({ posts: [] })]];
    await click(screen.getByText("Refresh"));
    expect(c.textContent).toContain("No posts in the current window");
  });

  it("calendar tab — grid renders posts, month stepping wraps year", async () => {
    // pin "today" to Nov 2026 so the grid opens on the fixture month
    vi.useFakeTimers({ now: new Date("2026-11-05T00:00:00Z"), toFake: ["Date"] });
    const c = await renderPage();
    await click(screen.getByText("calendar"));
    const monthLabel = () =>
      c.querySelector(".flex.items-center.gap-2 > span")!.textContent;
    expect(monthLabel()).toContain("November 2026");
    expect(c.textContent).toContain("content p-q".slice(0, 18));
    // step forward past December wraps year
    await click(c.querySelectorAll("button.rounded.border")[1]); // → Dec
    await click(c.querySelectorAll("button.rounded.border")[1]); // → Jan 2027
    expect(monthLabel()).toContain("January 2027");
    // step back wraps to previous year
    await click(c.querySelectorAll("button.rounded.border")[0]);
    await click(c.querySelectorAll("button.rounded.border")[0]);
    expect(monthLabel()).toContain("November 2026");
    vi.useRealTimers();
  });

  it("bulk tab — validation, schedule-all with interval spacing", async () => {
    const c = await renderPage();
    await click(screen.getByText("bulk"));
    await click(screen.getByText("Schedule all"));
    expect(c.textContent).toContain("Need content lines, channels, and a start time");

    await click(screen.getByText(/x chan/));
    await click(screen.getByText(/tiktok chan/));
    fireEvent.change(document.getElementById("postiz-bulk-lines")!, {
      target: { value: "line one\n\nline two" },
    });
    fireEvent.change(document.getElementById("postiz-bulk-start")!, {
      target: { value: "2026-11-01T09:00" },
    });
    fireEvent.change(document.getElementById("postiz-bulk-interval")!, {
      target: { value: "48" },
    });
    await click(screen.getByText("Schedule all"));
    // success → onPosted() switches to schedule tab (feedback unmounts with BulkTab)

    const bulkCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([u]) => String(u).includes("posts/bulk")
    );
    const items = JSON.parse(String(bulkCall![1].body)).items;
    expect(items).toHaveLength(2); // empty line filtered
    expect(items[0].posts).toHaveLength(2); // both channels
    expect(items[0].posts[1].settings.__type).toBe("tiktok");
    // interval: item2 = start + 48h
    const d1 = new Date(items[0].date).getTime();
    const d2 = new Date(items[1].date).getTime();
    expect(d2 - d1).toBe(48 * 3600 * 1000);

    // failure path — fresh BulkTab mount resets state, refill the form
    routes = [["POST", "postiz/posts/bulk", okJson({ error: "kaput" }, 500)]];
    await click(screen.getByText("bulk"));
    await click(screen.getByText(/x chan/));
    fireEvent.change(document.getElementById("postiz-bulk-lines")!, {
      target: { value: "only line" },
    });
    fireEvent.change(document.getElementById("postiz-bulk-start")!, {
      target: { value: "2026-11-01T09:00" },
    });
    await click(screen.getByText("Schedule all"));
    expect(c.textContent).toContain("Bulk failed: 500 kaput");
  });

  it("provider settings — tiktok/youtube/discord/linkedin/instagram/unknown rows", async () => {
    const c = await renderPage();
    await click(screen.getByText(/tiktok chan/));
    await click(screen.getByText(/youtube chan/));
    await click(screen.getByText(/discord chan/));
    await click(screen.getByText(/linkedin chan/));
    await click(screen.getByText(/instagram chan/));
    await click(screen.getByText(/threads chan/));
    await click(screen.getByText(/Provider-specific settings/));

    // tiktok: privacy + 3 checkboxes
    const publics = screen.getAllByDisplayValue("Public"); // tiktok privacy + yt visibility
    fireEvent.change(publics[0], { target: { value: "SELF_ONLY" } });
    await click(screen.getByLabelText("Allow comments"));
    await click(screen.getByLabelText("Allow duet"));
    await click(screen.getByLabelText("Allow stitch"));

    // youtube: title + 2 selects
    fireEvent.change(screen.getByPlaceholderText("cloudless.gr post"), {
      target: { value: "Vid Title" },
    });
    fireEvent.change(publics[1], { target: { value: "unlisted" } });
    fireEvent.change(screen.getByDisplayValue("No"), { target: { value: "yes" } });

    // discord channel
    fireEvent.change(screen.getByPlaceholderText("#general or channel id"), {
      target: { value: "#announce" },
    });

    // linkedin carousel checkbox, instagram post-type, threads fallback row
    await click(screen.getByLabelText("Post images as carousel"));
    fireEvent.change(screen.getByDisplayValue("Feed post"), { target: { value: "reel" } });
    expect(c.textContent).toContain("no provider-specific knobs");
  });
});
