/**
 * Tests for POST /api/admin/ai/langgraph — the LangGraph Agent Server proxy.
 *
 * Every action is a thin dispatch over @/lib/langgraph-client; the client is
 * mocked and we assert dispatch, argument mapping, guard clauses, SSE
 * pass-through, and the down/upstream error ladder.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  const { NextResponse } = await import("next/server");
  return {
    ...actual,
    requireAdmin: async (request: NextRequest) => {
      const h = request.headers.get("authorization") ?? "";
      if (h === "Bearer test-admin-session") return { ok: true as const, user: {} };
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
      };
    },
  };
});

const client = vi.hoisted(() => ({
  getCloudlessAssistant: vi.fn(),
  listAssistants: vi.fn(),
  createLangGraphThread: vi.fn(),
  getLangGraphThread: vi.fn(),
  patchLangGraphThread: vi.fn(),
  getLangGraphThreadState: vi.fn(),
  updateLangGraphThreadState: vi.fn(),
  deleteLangGraphThread: vi.fn(),
  searchLangGraphThreads: vi.fn(),
  getLangGraphThreadHistory: vi.fn(),
  streamLangGraphRun: vi.fn(),
  createBackgroundRun: vi.fn(),
  joinRunStream: vi.fn(),
  cancelRun: vi.fn(),
  listRuns: vi.fn(),
  getRun: vi.fn(),
  invokeLangGraphRun: vi.fn(),
  resumeInterruptedRun: vi.fn(),
  storeGet: vi.fn(),
  storePut: vi.fn(),
  storeDelete: vi.fn(),
  storeSearch: vi.fn(),
  storeListNamespaces: vi.fn(),
}));

vi.mock("@/lib/langgraph-client", () => client);

import { POST } from "@/app/api/admin/ai/langgraph/route";

const URL = "http://localhost/api/admin/ai/langgraph";

function req(body?: unknown, admin = true): NextRequest {
  return new NextRequest(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(admin ? { authorization: "Bearer test-admin-session" } : {}),
    },
    body: body === undefined ? "not-json{{{" : JSON.stringify(body),
  });
}

async function call(body: unknown): Promise<Response> {
  return POST(req(body));
}

const sseRes = (ok = true, status = 200) =>
  new Response(ok ? new ReadableStream({ start: (c) => c.close() }) : "boom", {
    status: ok ? 200 : status,
  });

describe("POST /api/admin/ai/langgraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    client.getCloudlessAssistant.mockResolvedValue({ assistant_id: "a1" });
    client.listAssistants.mockResolvedValue([{ assistant_id: "a1" }]);
    client.createLangGraphThread.mockResolvedValue({ thread_id: "t1" });
    client.getLangGraphThread.mockResolvedValue({ thread_id: "t1" });
    client.patchLangGraphThread.mockResolvedValue({ thread_id: "t1" });
    client.getLangGraphThreadState.mockResolvedValue({ values: {} });
    client.updateLangGraphThreadState.mockResolvedValue(undefined);
    client.deleteLangGraphThread.mockResolvedValue(undefined);
    client.searchLangGraphThreads.mockResolvedValue([]);
    client.getLangGraphThreadHistory.mockResolvedValue([]);
    client.streamLangGraphRun.mockResolvedValue(sseRes());
    client.createBackgroundRun.mockResolvedValue({ run_id: "r1" });
    client.joinRunStream.mockResolvedValue(sseRes());
    client.cancelRun.mockResolvedValue(undefined);
    client.listRuns.mockResolvedValue([]);
    client.getRun.mockResolvedValue({ run_id: "r1" });
    client.invokeLangGraphRun.mockResolvedValue({ output: "done" });
    client.resumeInterruptedRun.mockResolvedValue(sseRes());
    client.storeGet.mockResolvedValue({ value: 1 });
    client.storePut.mockResolvedValue(undefined);
    client.storeDelete.mockResolvedValue(undefined);
    client.storeSearch.mockResolvedValue([]);
    client.storeListNamespaces.mockResolvedValue(["ns"]);
  });

  it("rejects non-admin", async () => {
    const res = await POST(req({ action: "health" }, false));
    expect(res.status).toBe(403);
  });

  it("rejects invalid JSON", async () => {
    const res = await POST(req());
    expect(res.status).toBe(400);
  });

  it("rejects missing action", async () => {
    const res = await call({});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/action/i);
  });

  it("health checks upstream /ok", async () => {
    const res = await call({ action: "health" });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/ok"),
      expect.anything()
    );
  });

  it("get-assistant", async () => {
    const j = await (await call({ action: "get-assistant" })).json();
    expect(j.assistant_id).toBe("a1");
  });

  it("list-assistants passes graph_id", async () => {
    const j = await (await call({ action: "list-assistants", graph_id: "g" })).json();
    expect(client.listAssistants).toHaveBeenCalledWith("g");
    expect(j.assistants).toHaveLength(1);
  });

  it("create-thread", async () => {
    const j = await (await call({ action: "create-thread", metadata: { a: 1 } })).json();
    expect(client.createLangGraphThread).toHaveBeenCalledWith({ a: 1 });
    expect(j.thread_id).toBe("t1");
  });

  it.each(["get-thread", "patch-thread", "get-thread-state", "update-thread-state", "delete-thread", "get-thread-history", "list-runs"])(
    "%s requires thread_id",
    async (action) => {
      const res = await call({ action });
      expect(res.status).toBe(400);
    }
  );

  it("get-thread", async () => {
    const j = await (await call({ action: "get-thread", thread_id: "t1" })).json();
    expect(client.getLangGraphThread).toHaveBeenCalledWith("t1");
    expect(j.thread_id).toBe("t1");
  });

  it("patch-thread defaults metadata", async () => {
    await call({ action: "patch-thread", thread_id: "t1" });
    expect(client.patchLangGraphThread).toHaveBeenCalledWith("t1", {});
  });

  it("get-thread-state", async () => {
    await call({ action: "get-thread-state", thread_id: "t1" });
    expect(client.getLangGraphThreadState).toHaveBeenCalledWith("t1");
  });

  it("update-thread-state", async () => {
    const j = await (
      await call({ action: "update-thread-state", thread_id: "t1", values: { x: 1 }, as_node: "n" })
    ).json();
    expect(client.updateLangGraphThreadState).toHaveBeenCalledWith("t1", { x: 1 }, "n");
    expect(j.ok).toBe(true);
  });

  it("delete-thread", async () => {
    const j = await (await call({ action: "delete-thread", thread_id: "t1" })).json();
    expect(j.deleted).toBe("t1");
  });

  it("list-threads maps filters", async () => {
    await call({ action: "list-threads", limit: 5, metadata: { k: "v" }, status: "idle" });
    expect(client.searchLangGraphThreads).toHaveBeenCalledWith(5, { k: "v" }, "idle");
  });

  it("get-thread-history", async () => {
    await call({ action: "get-thread-history", thread_id: "t1", limit: 3 });
    expect(client.getLangGraphThreadHistory).toHaveBeenCalledWith("t1", 3);
  });

  it("stream-run requires ids", async () => {
    expect((await call({ action: "stream-run" })).status).toBe(400);
    expect((await call({ action: "stream-run", thread_id: "t1" })).status).toBe(400);
  });

  it("stream-run maps options and returns SSE", async () => {
    const res = await call({
      action: "stream-run",
      thread_id: "t1",
      assistant_id: "a1",
      messages: [{ role: "user", content: "hi" }],
      stream_mode: ["values"],
      interrupt_before: ["n1"],
      on_disconnect: "cancel",
      multitask_strategy: "rollback",
      if_not_exists: "create",
      metadata: { m: 1 },
      config: { c: 1 },
    });
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(client.streamLangGraphRun).toHaveBeenCalledWith(
      "t1",
      "a1",
      [{ role: "user", content: "hi" }],
      expect.objectContaining({
        streamMode: ["values"],
        interruptBefore: ["n1"],
        onDisconnect: "cancel",
        multitaskStrategy: "rollback",
        ifNotExists: "create",
      })
    );
  });

  it("stream-run 502s on upstream failure", async () => {
    client.streamLangGraphRun.mockResolvedValue(sseRes(false, 500));
    const res = await call({
      action: "stream-run",
      thread_id: "t1",
      assistant_id: "a1",
    });
    expect(res.status).toBe(502);
  });

  it("create-run", async () => {
    const j = await (
      await call({
        action: "create-run",
        thread_id: "t1",
        assistant_id: "a1",
        messages: [],
        multitask_strategy: "enqueue",
      })
    ).json();
    expect(j.run_id).toBe("r1");
  });

  it("create-run requires ids", async () => {
    expect((await call({ action: "create-run" })).status).toBe(400);
  });

  it("join-run-stream SSE + guards", async () => {
    expect((await call({ action: "join-run-stream" })).status).toBe(400);
    const res = await call({ action: "join-run-stream", thread_id: "t1", run_id: "r1" });
    expect(res.headers.get("content-type")).toBe("text/event-stream");
  });

  it("join-run-stream 502 on upstream failure", async () => {
    client.joinRunStream.mockResolvedValue(sseRes(false, 503));
    const res = await call({ action: "join-run-stream", thread_id: "t1", run_id: "r1" });
    expect(res.status).toBe(502);
  });

  it("cancel-run", async () => {
    expect((await call({ action: "cancel-run" })).status).toBe(400);
    const j = await (
      await call({ action: "cancel-run", thread_id: "t1", run_id: "r1", wait: true })
    ).json();
    expect(client.cancelRun).toHaveBeenCalledWith("t1", "r1", true);
    expect(j.cancelled).toBe("r1");
  });

  it("list-runs", async () => {
    await call({ action: "list-runs", thread_id: "t1", limit: 7 });
    expect(client.listRuns).toHaveBeenCalledWith("t1", 7);
  });

  it("get-run", async () => {
    expect((await call({ action: "get-run", thread_id: "t1" })).status).toBe(400);
    const j = await (
      await call({ action: "get-run", thread_id: "t1", run_id: "r1" })
    ).json();
    expect(j.run_id).toBe("r1");
  });

  it("invoke-run requires all three", async () => {
    expect((await call({ action: "invoke-run", thread_id: "t1", assistant_id: "a1" })).status).toBe(400);
    const j = await (
      await call({
        action: "invoke-run",
        thread_id: "t1",
        assistant_id: "a1",
        messages: [{ role: "user", content: "x" }],
        config: { tags: ["t"] },
      })
    ).json();
    expect(j.output).toBe("done");
  });

  it("resume-run SSE + guards + 502", async () => {
    expect((await call({ action: "resume-run" })).status).toBe(400);
    const res = await call({
      action: "resume-run",
      thread_id: "t1",
      assistant_id: "a1",
      resume_value: "yes",
    });
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    client.resumeInterruptedRun.mockResolvedValue(sseRes(false, 500));
    expect(
      (
        await call({ action: "resume-run", thread_id: "t1", assistant_id: "a1" })
      ).status
    ).toBe(502);
  });

  it("store-get/put/delete guards + dispatch", async () => {
    expect((await call({ action: "store-get" })).status).toBe(400);
    expect((await call({ action: "store-put", namespace: ["n"], key: "k" })).status).toBe(400);
    expect((await call({ action: "store-delete" })).status).toBe(400);

    const j = await (
      await call({ action: "store-get", namespace: ["n"], key: "k" })
    ).json();
    expect(j.value).toBe(1);
    await call({ action: "store-put", namespace: ["n"], key: "k", value: { v: 1 } });
    expect(client.storePut).toHaveBeenCalledWith(["n"], "k", { v: 1 });
    await call({ action: "store-delete", namespace: ["n"], key: "k" });
    expect(client.storeDelete).toHaveBeenCalledWith(["n"], "k");
  });

  it("store-search + list-namespaces", async () => {
    expect((await call({ action: "store-search" })).status).toBe(400);
    await call({
      action: "store-search",
      namespace_prefix: ["p"],
      query: "q",
      limit: 2,
      filter: { f: 1 },
    });
    expect(client.storeSearch).toHaveBeenCalledWith(["p"], {
      query: "q",
      limit: 2,
      filter: { f: 1 },
    });
    const j = await (
      await call({ action: "store-list-namespaces", prefix: ["a"], suffix: ["z"] })
    ).json();
    expect(j.namespaces).toEqual(["ns"]);
  });

  it("unknown action → 400", async () => {
    const res = await call({ action: "nope" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("nope");
  });

  it("connection-refused upstream → 503 with how-to-fix", async () => {
    client.getCloudlessAssistant.mockRejectedValue(new Error("fetch failed ECONNREFUSED"));
    const res = await call({ action: "get-assistant" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("LangGraph server not running");
  });

  it("generic upstream error → 500 with message", async () => {
    client.getCloudlessAssistant.mockRejectedValue(new Error("weird boom"));
    const res = await call({ action: "get-assistant" });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("weird boom");
  });
});
