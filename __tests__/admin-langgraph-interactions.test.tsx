/**
 * Populated-state interaction tests for the LangGraph admin page —
 * health/assistant/threads init, thread create/switch/delete, SSE
 * stream-run parsing (messages + updates modes), interrupt/resume flow,
 * error bubbles, and the store/runs sidebar panels.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const sse = (lines: string[]) =>
  new Response(
    new ReadableStream({
      start(c) {
        for (const l of lines) c.enqueue(new TextEncoder().encode(l));
        c.close();
      },
    }),
    { status: 200 }
  );

// action → response (or fn of parsed body)
let routes: Record<string, unknown> = {};

const fetchWithAuthMock = vi.fn(async (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? "{}")) as { action: string };
  const out = routes[body.action];
  const res = typeof out === "function" ? out(body) : out;
  if (res instanceof Response) return res;
  if (res === undefined) return new Response(JSON.stringify({ error: "no route" }), { status: 500 });
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
    "store-put": {},
    "store-delete": {},
    "store-search": { items: [] },
    "list-runs": { runs: [] },
  };
}

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<LangGraphPage />).container;
  });
  return c!;
}

const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};

const actionCalls = (action: string) =>
  fetchWithAuthMock.mock.calls.filter(
    ([, i]) => JSON.parse(String(i?.body)).action === action
  );

describe("langgraph admin — populated interactions", () => {
  beforeEach(() => {
    healthy();
    fetchWithAuthMock.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("healthy init — assistant + threads render; suggestions grid", async () => {
    const t = { thread_id: "th-1", created_at: "t", label: "My thread" };
    healthy([t]);
    const c = await renderPage();
    expect(c.textContent).toContain("agent-graph");
    expect(c.textContent).toContain("My thread");
    expect(c.textContent).toContain("Cloudless.gr Agent");
    expect(screen.getByText("Get the web analytics")).toBeTruthy();
    expect(actionCalls("health")).toHaveLength(1);
    expect(actionCalls("get-assistant")).toHaveLength(1);
  });

  it("offline — health false shows offline UI, disables input; api error path too", async () => {
    routes = { health: { ok: false } };
    let c = await renderPage();
    expect(c.textContent).toContain("Server offline");
    expect(c.textContent).toContain("langgraph dev --port 2024");
    cleanup();

    // api-level failure → catch → offline
    routes = { health: new Response(JSON.stringify({ error: "boom" }), { status: 500 }) };
    c = await renderPage();
    expect(c.textContent).toContain("Server offline");
  });

  it("new thread, switch thread (interrupt state), delete thread", async () => {
    const t1 = { thread_id: "th-1", created_at: "t" };
    const t2 = { thread_id: "th-2", created_at: "t", label: "Two" };
    healthy([t1, t2]);
    routes["get-thread-state"] = {
      values: {
        messages: [
          { type: "human", content: "hi there" },
          { type: "ai", content: "hello!" },
          { type: "tool", content: "ignored" },
        ],
      },
      next: ["approval-node"],
    };
    const c = await renderPage();

    // switch to t1 → state replayed, interrupt bubble + banner
    await click(screen.getByText("Thread th-1"));
    expect(c.textContent).toContain("hi there");
    expect(c.textContent).toContain("hello!");
    expect(c.textContent).toContain("Paused before: approval-node");
    expect(c.textContent).toContain("Run paused — provide input to resume");
    expect(actionCalls("get-thread-state")).toHaveLength(1);

    // dismiss resume banner
    await click(screen.getByText("Dismiss"));
    expect(c.textContent).not.toContain("Run paused");

    // new thread button
    await click(screen.getByText("＋"));
    expect(c.textContent).toContain("Thread th-new");
    expect(actionCalls("create-thread")).toHaveLength(1);

    // delete the active thread → list shrinks, selection clears
    const delBtn = screen.getByText("Thread th-new").closest("button")!.querySelector("span.ml-1")!;
    await click(delBtn);
    expect(actionCalls("delete-thread")).toHaveLength(1);
    expect(c.textContent).not.toContain("Thread th-new");
  });

  it("send → creates thread, streams messages-mode SSE, renders reply", async () => {
    healthy();
    routes["stream-run"] = sse([
      'data: {"run_id":"run-abc"}\n',
      'data: [{"content":"partial"}]\n',
      "data: not-json\n", // malformed → skipped
      'data: [{"content":"full reply"}]\n',
      "data: [DONE]\n",
      "",
    ]);
    const c = await renderPage();

    // suggestion button send (overrideText path)
    await click(screen.getByText("Check cluster health"));
    expect(c.textContent).toContain("full reply");
    expect(c.textContent).toContain("run:run-abc");

    // a thread was auto-created + labeled from the text
    const create = actionCalls("create-thread")[0];
    expect(create).toBeTruthy();
    const stream = actionCalls("stream-run")[0];
    expect(JSON.parse(String(stream[1].body)).stream_mode).toEqual(["messages"]);
    expect(c.textContent).toContain("Check cluster he"); // label truncated at 45
  });

  it("send on existing thread — updates-mode SSE + label backfill", async () => {
    const t = { thread_id: "th-x", created_at: "t" }; // unlabeled → label backfills
    healthy([t]);
    routes["stream-run"] = sse([
      'data: {"responder":{"messages":[{"content":"from updates"}]}}\n',
    ]);
    const c = await renderPage();

    // switch to the existing thread first
    await click(screen.getByText("Thread th-x"));

    // switch to updates mode
    fireEvent.change(screen.getByDisplayValue("messages (default)"), {
      target: { value: "updates" },
    });

    // type + Enter
    const ta = c.querySelector("textarea[placeholder*='Ask anything']") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "status?" } });
    fireEvent.keyDown(ta, { key: "Enter" });
    await act(async () => {});
    expect(c.textContent).toContain("from updates");
    // no create-thread call — used existing
    expect(actionCalls("create-thread")).toHaveLength(0);
    expect(c.textContent).toContain("status?"); // label backfilled
  });

  it("interrupt during stream → resume banner → resume-run stream completes", async () => {
    const t = { thread_id: "th-1", created_at: "t" };
    healthy([t]);
    routes["stream-run"] = sse([
      'data: {"run_id":"run-int"}\n',
      'data: [{"content":"need input"}]\n',
      'data: {"type":"interrupt"}\n',
    ]);
    routes["resume-run"] = sse(['data: [{"content":"resumed answer"}]\n']);
    const c = await renderPage();
    await click(screen.getByText("Thread th-1"));

    const ta = c.querySelector("textarea[placeholder*='Ask anything']") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "go" } });
    await click(screen.getByRole("button", { name: "" }) === null ? c.querySelector("button.bg-violet-600")! : c.querySelector("button.bg-violet-600")!);
    expect(c.textContent).toContain("Run paused — waiting for input");

    // resume via input + button
    const resumeInput = screen.getByPlaceholderText(/Resume value/);
    fireEvent.change(resumeInput, { target: { value: "yes" } });
    await click(screen.getByText("Resume"));
    expect(c.textContent).toContain("resumed answer");
    expect(actionCalls("resume-run")).toHaveLength(1);
    const resumeBody = JSON.parse(String(actionCalls("resume-run")[0][1].body));
    expect(resumeBody.resume_value).toBe("yes");
  });

  it("stream error → error bubble; api !ok throws with error body", async () => {
    healthy();
    routes["stream-run"] = new Response(JSON.stringify({ error: "upstream died" }), { status: 502 });
    const c = await renderPage();
    await click(screen.getByText("Show me the leads"));
    expect(c.textContent).toContain("upstream died");
    expect(c.querySelector(".bg-red-900\\/30")).toBeTruthy();
  });

  it("store panel — get/put (JSON + plain fallback)/del/search", async () => {
    const c = await renderPage();
    await click(screen.getByText("store"));

    const [, key] = Array.from(c.querySelectorAll("input")) as HTMLInputElement[];
    const valArea = c.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(key, { target: { value: "mykey" } });

    routes["store-get"] = { item: { v: 1 } };
    await click(screen.getByText("Get"));
    expect(c.textContent).toContain('"v": 1');
    expect(JSON.parse(String(actionCalls("store-get")[0][1].body)).namespace).toEqual(["cloudless"]);

    // JSON value
    fireEvent.change(valArea, { target: { value: '{"a":2}' } });
    await click(screen.getByText("Put"));
    expect(c.textContent).toContain("Stored.");
    expect(JSON.parse(String(actionCalls("store-put")[0][1].body)).value).toEqual({ a: 2 });

    // plain-text value → {value} fallback
    fireEvent.change(valArea, { target: { value: "plain" } });
    await click(screen.getByText("Put"));
    expect(JSON.parse(String(actionCalls("store-put")[1][1].body)).value).toEqual({ value: "plain" });

    await click(screen.getByText("Del"));
    expect(c.textContent).toContain("Deleted.");

    routes["store-search"] = { items: ["k1"] };
    await click(screen.getByText("Search"));
    expect(c.textContent).toContain("k1");
    expect(JSON.parse(String(actionCalls("store-search")[0][1].body)).query).toBe("mykey");

    // error path
    routes["store-get"] = new Response(JSON.stringify({ error: "ns gone" }), { status: 404 });
    await click(screen.getByText("Get"));
    expect(c.textContent).toContain("Error: ns gone");
  });

  it("runs panel — select prompt, load runs with status colors", async () => {
    const t = { thread_id: "th-1", created_at: "t" };
    healthy([t]);
    const c = await renderPage();
    await click(screen.getByText("runs"));
    expect(c.textContent).toContain("Select a thread");

    routes["get-thread-state"] = { values: { messages: [] } };
    // thread buttons live on the chat tab
    await click(screen.getByText("chat"));
    await click(screen.getByText("Thread th-1"));
    // thread switch re-renders RunsPanel → auto-loads
    routes["list-runs"] = {
      runs: [
        { run_id: "r-succ", status: "success", created_at: "t" },
        { run_id: "r-err", status: "error", created_at: "t" },
        { run_id: "r-pend", status: "pending", created_at: "t" },
        { run_id: "r-oth", status: "interrupted", created_at: "t" },
      ],
    };
    await click(c.querySelector("button.text-\\[10px\\].text-zinc-600") ?? screen.getByText("↺"));
    await click(screen.getByText("runs"));
    expect(c.textContent).toContain("r-succ");
    expect(c.textContent).toContain("error");
    expect(c.textContent).toContain("pending");
  });
});
