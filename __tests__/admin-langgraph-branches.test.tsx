/**
 * LangGraph admin page branch tests: api() error-body fallbacks, non-Error
 * rejections in the store panel / stream / resume, missing response fields,
 * SSE edge lines (non-data lines, non-string chunks, events split across reads,
 * missing stream body), send/resume guards, thread switch/delete edges and
 * the runs-panel unmount guard.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const okJson = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const sse = (chunks: string[]) =>
  new Response(
    new ReadableStream({
      start(c) {
        for (const l of chunks) c.enqueue(new TextEncoder().encode(l));
        c.close();
      },
    }),
    { status: 200 }
  );

let routes: Record<string, unknown> = {};
const fetchWithAuthMock = vi.fn(async (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? "{}")) as { action: string };
  const out = routes[body.action];
  const res = typeof out === "function" ? await out(body) : out;
  if (res instanceof Response) return res;
  if (res === undefined) return okJson({ error: "no route" }, { status: 500 });
  return okJson(res);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

import LangGraphPage from "@/app/[locale]/admin/langgraph/page";

function healthy(threads: unknown[] = []) {
  routes = {
    health: { ok: true },
    "get-assistant": { assistant_id: "asst-1", graph_id: "agent-graph", name: "Agent" },
    "list-threads": { threads },
    "create-thread": { thread_id: "th-new", created_at: "t" },
    "get-thread-state": { values: { messages: [] } },
    "delete-thread": {},
    "list-runs": { runs: [] },
  };
}

async function renderPage() {
  let r: ReturnType<typeof render> | undefined;
  await act(async () => {
    r = render(<LangGraphPage />);
  });
  return r!;
}

const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};

const bodies = (action: string) =>
  fetchWithAuthMock.mock.calls
    .map(([, i]) => JSON.parse(String(i?.body)) as Record<string, unknown>)
    .filter((b) => b.action === action);

const chatBox = (c: HTMLElement) =>
  c.querySelector("textarea[placeholder*='Ask anything']") as HTMLTextAreaElement;

async function sendText(c: HTMLElement, text: string) {
  fireEvent.change(chatBox(c), { target: { value: text } });
  await act(async () => fireEvent.keyDown(chatBox(c), { key: "Enter" }));
  await act(async () => {});
}

/** Switch to a thread whose state is paused, so the resume banner shows. */
async function openPausedThread() {
  routes["get-thread-state"] = { values: { messages: [] }, next: ["approve"] };
  await click(screen.getByText("Thread th-1"));
  expect(screen.getByText("Run paused — provide input to resume:")).toBeTruthy();
}

describe("langgraph admin — branch coverage", () => {
  beforeEach(() => {
    healthy([{ thread_id: "th-1", created_at: "t" }]);
    fetchWithAuthMock.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("api errors: unreadable body uses statusText, body without error uses HTTP status", async () => {
    routes["stream-run"] = new Response("<html>", { status: 503, statusText: "Upstream Down" });
    const { container: c } = await renderPage();
    await click(screen.getByText("Thread th-1"));
    await sendText(c, "first");
    expect(c.textContent).toContain("Upstream Down");

    routes["stream-run"] = okJson({}, { status: 502 });
    await sendText(c, "second");
    expect(c.textContent).toContain("HTTP 502");
  });

  it("stream: missing body, and non-Error rejection rendered via String()", async () => {
    routes["stream-run"] = new Response(null, { status: 200 });
    const { container: c } = await renderPage();
    await click(screen.getByText("Thread th-1"));
    await sendText(c, "hello");
    expect(c.textContent).toContain("No stream body");

    routes["stream-run"] = () => Promise.reject("socket closed");
    await sendText(c, "again");
    expect(c.textContent).toContain("socket closed");
  });

  it("messages-mode SSE ignores non-data lines, non-string chunks and reassembles a split event", async () => {
    routes["stream-run"] = sse([
      "event: metadata\n",
      "data: \n",
      'data: [{"content":42}]\n',
      "data: []\n",
      // one event split across two reads: the partial line is carried in the
      // buffer until its newline arrives
      'data: [{"content":"tail ',
      'reply"}]\n',
      'data: {"type":"interrupt"}\n',
    ]);
    const { container: c } = await renderPage();
    await click(screen.getByText("Thread th-1"));
    await sendText(c, "go");
    expect(c.textContent).toContain("tail reply");
    // interrupt without a run_id still opens the resume banner
    expect(c.textContent).toContain("Run paused — waiting for input");
    expect(c.textContent).toContain("Run paused — provide input to resume:");
  });

  it("updates-mode SSE: responder without messages or content leaves the reply empty", async () => {
    routes["stream-run"] = sse([
      'data: {"responder":{}}\n',
      'data: {"responder":{"messages":[]}}\n',
      'data: {"responder":{"messages":[{}]}}\n',
      'data: {"other":{"messages":[{"content":"not the responder"}]}}\n',
      "data: 5\n",
    ]);
    const { container: c } = await renderPage();
    await click(screen.getByText("Thread th-1"));
    fireEvent.change(screen.getByDisplayValue("messages (default)"), {
      target: { value: "updates" },
    });
    await sendText(c, "status?");
    expect(bodies("stream-run")[0].stream_mode).toEqual(["updates"]);
    expect(c.textContent).not.toContain("not the responder");
    expect(c.textContent).toContain("status?");
  });

  it("send guards: whitespace, Shift+Enter; labelled thread keeps its label", async () => {
    healthy([
      { thread_id: "th-1", created_at: "t", label: "Pinned label" },
      { thread_id: "th-2", created_at: "t" },
    ]);
    routes["stream-run"] = sse(['data: [{"content":"ok"}]\n']);
    const { container: c } = await renderPage();
    await click(screen.getByText("Pinned label"));

    fireEvent.change(chatBox(c), { target: { value: "   " } });
    await act(async () => fireEvent.keyDown(chatBox(c), { key: "Enter" }));
    fireEvent.change(chatBox(c), { target: { value: "multi" } });
    await act(async () => fireEvent.keyDown(chatBox(c), { key: "Enter", shiftKey: true }));
    expect(bodies("stream-run")).toHaveLength(0);

    await act(async () => fireEvent.keyDown(chatBox(c), { key: "Enter" }));
    expect(bodies("stream-run")).toHaveLength(1);
    expect(c.textContent).toContain("Pinned label");
    expect(c.textContent).toContain("Thread th-2");
  });

  it("threads: missing list, re-selecting the active thread, sparse state messages", async () => {
    routes["list-threads"] = {};
    let r = await renderPage();
    expect(r.container.textContent).not.toContain("Thread th-1");
    cleanup();

    healthy([{ thread_id: "th-1", created_at: "t" }]);
    routes["get-thread-state"] = {
      values: { messages: [{ type: "ai" }, { type: "human", content: "q" }] },
    };
    r = await renderPage();
    await click(screen.getByText("Thread th-1"));
    await click(screen.getByText("Thread th-1"));
    expect(bodies("get-thread-state")).toHaveLength(1);
    expect(r.container.textContent).toContain("q");
    cleanup();

    healthy([{ thread_id: "th-1", created_at: "t" }]);
    routes["get-thread-state"] = {};
    r = await renderPage();
    await click(screen.getByText("Thread th-1"));
    expect(r.container.textContent).not.toContain("Paused before");
  });

  it("deleting a non-active thread keeps the selection; failed delete still removes it", async () => {
    healthy([
      { thread_id: "th-1", created_at: "t" },
      { thread_id: "th-2", created_at: "t" },
    ]);
    routes["get-thread-state"] = { values: { messages: [{ type: "human", content: "kept msg" }] } };
    routes["delete-thread"] = okJson({ error: "nope" }, { status: 500 });
    const { container: c } = await renderPage();
    await click(screen.getByText("Thread th-1"));
    const del = screen.getByText("Thread th-2").closest("button")!.querySelector("span.ml-1")!;
    await click(del);
    expect(bodies("delete-thread")).toEqual([{ action: "delete-thread", thread_id: "th-2" }]);
    expect(c.textContent).not.toContain("Thread th-2");
    expect(c.textContent).toContain("kept msg");
  });

  it("resume: guards, missing body, SSE edge lines, non-Error rejection", async () => {
    const { container: c } = await renderPage();
    await openPausedThread();
    const resume = () => screen.getByPlaceholderText(/Resume value/);

    // empty value + Enter, and non-Enter keys, do nothing
    await act(async () => fireEvent.keyDown(resume(), { key: "Enter" }));
    fireEvent.change(resume(), { target: { value: "yes" } });
    await act(async () => fireEvent.keyDown(resume(), { key: "a" }));
    expect(bodies("resume-run")).toHaveLength(0);

    routes["resume-run"] = new Response(null, { status: 200 });
    await act(async () => fireEvent.keyDown(resume(), { key: "Enter" }));
    expect(c.textContent).toContain("No stream body");

    routes["resume-run"] = () => Promise.reject("resume socket closed");
    await act(async () => fireEvent.keyDown(resume(), { key: "Enter" }));
    expect(c.textContent).toContain("resume socket closed");

    routes["resume-run"] = sse([
      "event: x\n",
      "data: \n",
      "data: [DONE]\n",
      'data: {"not":"array"}\n',
      'data: [{"content":7}]\n',
      "data: {broken\n",
      // one event split across three reads (buffer carry-over)
      'data: [{"content":"resumed ',
      'tail"}]',
      "\n",
    ]);
    await act(async () => fireEvent.keyDown(resume(), { key: "Enter" }));
    await act(async () => {});
    expect(c.textContent).toContain("resumed tail");
    expect(c.textContent).not.toContain("Run paused — provide input to resume:");
    expect(bodies("resume-run")).toHaveLength(3);
  });

  it("store panel: non-Error rejections and search without a query", async () => {
    const { container: c } = await renderPage();
    await click(screen.getByText("store"));
    for (const a of ["store-get", "store-put", "store-delete", "store-search"]) {
      routes[a] = () => Promise.reject(`${a} offline`);
    }
    for (const [label, action] of [
      ["Get", "store-get"],
      ["Put", "store-put"],
      ["Del", "store-delete"],
      ["Search", "store-search"],
    ]) {
      await click(screen.getByText(label));
      expect(c.querySelector("pre")!.textContent).toBe(`Error: ${action} offline`);
    }
    // key left empty → search sends no query
    expect(bodies("store-search")[0]).toEqual({
      action: "store-search",
      namespace_prefix: ["cloudless"],
      limit: 10,
    });
  });

  it("runs panel: missing runs list → empty copy; unmount before load skips the fetch", async () => {
    routes["list-runs"] = {};
    const { container: c } = await renderPage();
    await click(screen.getByText("Thread th-1"));
    await click(screen.getByText("runs"));
    expect(c.textContent).toContain("No runs yet");
    expect(bodies("list-runs")).toHaveLength(1);
    cleanup();

    healthy([{ thread_id: "th-1", created_at: "t" }]);
    fetchWithAuthMock.mockClear();
    const r = await renderPage();
    await click(screen.getByText("Thread th-1"));
    act(() => {
      fireEvent.click(screen.getByText("runs"));
    });
    r.unmount(); // before the queued microtask fires
    await act(async () => {
      await Promise.resolve();
    });
    expect(bodies("list-runs")).toHaveLength(0);
  });
});
