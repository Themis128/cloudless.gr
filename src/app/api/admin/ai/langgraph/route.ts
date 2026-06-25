/**
 * POST /api/admin/ai/langgraph
 *
 * Full LangGraph Agent Server protocol proxy — all actions require admin auth.
 *
 * ── System ──────────────────────────────────────────────────────────────────
 * "health"               → GET /ok
 *
 * ── Assistants ──────────────────────────────────────────────────────────────
 * "get-assistant"        → search for the cloudless graph assistant
 * "list-assistants"      → { graph_id? }
 *
 * ── Threads ─────────────────────────────────────────────────────────────────
 * "create-thread"        → { metadata? }
 * "get-thread"           → { thread_id }
 * "patch-thread"         → { thread_id, metadata }
 * "get-thread-state"     → { thread_id }
 * "update-thread-state"  → { thread_id, values, as_node? }
 * "delete-thread"        → { thread_id }
 * "list-threads"         → { limit?, metadata?, status? }
 * "get-thread-history"   → { thread_id, limit? }
 *
 * ── Streaming runs ──────────────────────────────────────────────────────────
 * "stream-run"           → { thread_id, assistant_id, messages[], stream_mode?,
 *                            interrupt_before?, interrupt_after?,
 *                            on_disconnect?, multitask_strategy?,
 *                            if_not_exists?, metadata?, config?, command? } → SSE
 *
 * ── Background runs ─────────────────────────────────────────────────────────
 * "create-run"           → { thread_id, assistant_id, messages[], ...opts } → Run JSON
 * "join-run-stream"      → { thread_id, run_id } → SSE
 * "cancel-run"           → { thread_id, run_id, wait? }
 * "list-runs"            → { thread_id, limit? }
 * "get-run"              → { thread_id, run_id }
 *
 * ── Blocking invoke ─────────────────────────────────────────────────────────
 * "invoke-run"           → { thread_id, assistant_id, messages[], config? } → JSON
 *
 * ── Human-in-the-loop ───────────────────────────────────────────────────────
 * "resume-run"           → { thread_id, assistant_id, resume_value, stream_mode? } → SSE
 *
 * ── Store (cross-thread memory) ─────────────────────────────────────────────
 * "store-get"            → { namespace[], key }
 * "store-put"            → { namespace[], key, value }
 * "store-delete"         → { namespace[], key }
 * "store-search"         → { namespace_prefix[], query?, limit?, filter? }
 * "store-list-namespaces"→ { prefix?, suffix? }
 */

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  getCloudlessAssistant,
  listAssistants,
  createLangGraphThread,
  getLangGraphThread,
  patchLangGraphThread,
  getLangGraphThreadState,
  updateLangGraphThreadState,
  deleteLangGraphThread,
  searchLangGraphThreads,
  getLangGraphThreadHistory,
  streamLangGraphRun,
  createBackgroundRun,
  joinRunStream,
  cancelRun,
  listRuns,
  getRun,
  invokeLangGraphRun,
  resumeInterruptedRun,
  storeGet,
  storePut,
  storeDelete,
  storeSearch,
  storeListNamespaces,
} from "@/lib/langgraph-client";
import type { StreamRunOptions } from "@/lib/langgraph-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGGRAPH_URL = process.env.LANGGRAPH_URL ?? "http://localhost:2024";

function sseResponse(upstream: Response): Response {
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function isDown(msg: string): boolean {
  return msg.includes("ECONNREFUSED") || msg.includes("fetch failed") || msg.includes("ENOTFOUND");
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as string | undefined;
  if (!action) return Response.json({ error: "Missing action" }, { status: 400 });

  try {
    switch (action) {
      // ── System ──────────────────────────────────────────────────────────────
      case "health": {
        const res = await fetch(`${LANGGRAPH_URL}/ok`, { signal: AbortSignal.timeout(5000) });
        return Response.json({ ok: res.ok, url: LANGGRAPH_URL });
      }

      // ── Assistants ──────────────────────────────────────────────────────────
      case "get-assistant":
        return Response.json(await getCloudlessAssistant());

      case "list-assistants": {
        const assistants = await listAssistants(body.graph_id as string | undefined);
        return Response.json({ assistants });
      }

      // ── Threads ─────────────────────────────────────────────────────────────
      case "create-thread":
        return Response.json(
          await createLangGraphThread(body.metadata as Record<string, unknown> | undefined)
        );

      case "get-thread": {
        const tid = body.thread_id as string;
        if (!tid) return Response.json({ error: "Missing thread_id" }, { status: 400 });
        return Response.json(await getLangGraphThread(tid));
      }

      case "patch-thread": {
        const tid = body.thread_id as string;
        if (!tid) return Response.json({ error: "Missing thread_id" }, { status: 400 });
        return Response.json(
          await patchLangGraphThread(tid, (body.metadata as Record<string, unknown>) ?? {})
        );
      }

      case "get-thread-state": {
        const tid = body.thread_id as string;
        if (!tid) return Response.json({ error: "Missing thread_id" }, { status: 400 });
        return Response.json(await getLangGraphThreadState(tid));
      }

      case "update-thread-state": {
        const tid = body.thread_id as string;
        if (!tid) return Response.json({ error: "Missing thread_id" }, { status: 400 });
        await updateLangGraphThreadState(
          tid,
          (body.values as Record<string, unknown>) ?? {},
          body.as_node as string | undefined
        );
        return Response.json({ ok: true });
      }

      case "delete-thread": {
        const tid = body.thread_id as string;
        if (!tid) return Response.json({ error: "Missing thread_id" }, { status: 400 });
        await deleteLangGraphThread(tid);
        return Response.json({ deleted: tid });
      }

      case "list-threads": {
        const threads = await searchLangGraphThreads(
          (body.limit as number) ?? 20,
          body.metadata as Record<string, unknown> | undefined,
          body.status as "idle" | "busy" | "interrupted" | "error" | undefined
        );
        return Response.json({ threads });
      }

      case "get-thread-history": {
        const tid = body.thread_id as string;
        if (!tid) return Response.json({ error: "Missing thread_id" }, { status: 400 });
        const history = await getLangGraphThreadHistory(tid, (body.limit as number) ?? 10);
        return Response.json({ history });
      }

      // ── Streaming run ────────────────────────────────────────────────────────
      case "stream-run": {
        const tid = body.thread_id as string;
        const aid = body.assistant_id as string;
        const msgs = (body.messages as Array<{ role: string; content: string }>) ?? [];
        if (!tid || !aid)
          return Response.json({ error: "Missing thread_id or assistant_id" }, { status: 400 });

        const opts: StreamRunOptions = {
          streamMode: (body.stream_mode as StreamRunOptions["streamMode"]) ?? ["messages"],
          interruptBefore: body.interrupt_before as StreamRunOptions["interruptBefore"],
          interruptAfter: body.interrupt_after as StreamRunOptions["interruptAfter"],
          onDisconnect: (body.on_disconnect as "cancel" | "continue") ?? "continue",
          multitaskStrategy:
            (body.multitask_strategy as StreamRunOptions["multitaskStrategy"]) ?? "enqueue",
          ifNotExists: (body.if_not_exists as "create" | "reject") ?? "reject",
          metadata: body.metadata as Record<string, unknown> | undefined,
          config: body.config as Record<string, unknown> | undefined,
          command: body.command as StreamRunOptions["command"] | undefined,
        };

        const upstream = await streamLangGraphRun(tid, aid, msgs, opts);
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return Response.json({ error: `LangGraph ${upstream.status}: ${text}` }, { status: 502 });
        }
        return sseResponse(upstream);
      }

      // ── Background run ───────────────────────────────────────────────────────
      case "create-run": {
        const tid = body.thread_id as string;
        const aid = body.assistant_id as string;
        const msgs = (body.messages as Array<{ role: string; content: string }>) ?? [];
        if (!tid || !aid)
          return Response.json({ error: "Missing thread_id or assistant_id" }, { status: 400 });
        const run = await createBackgroundRun(tid, aid, msgs, {
          multitaskStrategy: body.multitask_strategy as StreamRunOptions["multitaskStrategy"],
          metadata: body.metadata as Record<string, unknown> | undefined,
          config: body.config as Record<string, unknown> | undefined,
          interruptBefore: body.interrupt_before as StreamRunOptions["interruptBefore"],
          interruptAfter: body.interrupt_after as StreamRunOptions["interruptAfter"],
        });
        return Response.json(run);
      }

      case "join-run-stream": {
        const tid = body.thread_id as string;
        const rid = body.run_id as string;
        if (!tid || !rid)
          return Response.json({ error: "Missing thread_id or run_id" }, { status: 400 });
        const upstream = await joinRunStream(tid, rid);
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return Response.json({ error: `LangGraph ${upstream.status}: ${text}` }, { status: 502 });
        }
        return sseResponse(upstream);
      }

      case "cancel-run": {
        const tid = body.thread_id as string;
        const rid = body.run_id as string;
        if (!tid || !rid)
          return Response.json({ error: "Missing thread_id or run_id" }, { status: 400 });
        await cancelRun(tid, rid, Boolean(body.wait));
        return Response.json({ cancelled: rid });
      }

      case "list-runs": {
        const tid = body.thread_id as string;
        if (!tid) return Response.json({ error: "Missing thread_id" }, { status: 400 });
        const runs = await listRuns(tid, (body.limit as number) ?? 20);
        return Response.json({ runs });
      }

      case "get-run": {
        const tid = body.thread_id as string;
        const rid = body.run_id as string;
        if (!tid || !rid)
          return Response.json({ error: "Missing thread_id or run_id" }, { status: 400 });
        return Response.json(await getRun(tid, rid));
      }

      // ── Blocking invoke ──────────────────────────────────────────────────────
      case "invoke-run": {
        const tid = body.thread_id as string;
        const aid = body.assistant_id as string;
        const msgs = body.messages as Array<{ role: string; content: string }>;
        if (!tid || !aid || !msgs)
          return Response.json(
            { error: "Missing thread_id, assistant_id, or messages" },
            { status: 400 }
          );
        const result = await invokeLangGraphRun(tid, aid, msgs, {
          config: body.config as Record<string, unknown> | undefined,
          metadata: body.metadata as Record<string, unknown> | undefined,
        });
        return Response.json(result);
      }

      // ── Human-in-the-loop resume ─────────────────────────────────────────────
      case "resume-run": {
        const tid = body.thread_id as string;
        const aid = body.assistant_id as string;
        if (!tid || !aid)
          return Response.json({ error: "Missing thread_id or assistant_id" }, { status: 400 });
        const upstream = await resumeInterruptedRun(
          tid,
          aid,
          body.resume_value,
          body.stream_mode as StreamRunOptions["streamMode"]
        );
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return Response.json({ error: `LangGraph ${upstream.status}: ${text}` }, { status: 502 });
        }
        return sseResponse(upstream);
      }

      // ── Store ────────────────────────────────────────────────────────────────
      case "store-get": {
        const ns = body.namespace as string[];
        const key = body.key as string;
        if (!ns || !key)
          return Response.json({ error: "Missing namespace or key" }, { status: 400 });
        return Response.json(await storeGet(ns, key));
      }

      case "store-put": {
        const ns = body.namespace as string[];
        const key = body.key as string;
        const value = body.value as Record<string, unknown>;
        if (!ns || !key || value === undefined)
          return Response.json({ error: "Missing namespace, key, or value" }, { status: 400 });
        await storePut(ns, key, value);
        return Response.json({ ok: true });
      }

      case "store-delete": {
        const ns = body.namespace as string[];
        const key = body.key as string;
        if (!ns || !key)
          return Response.json({ error: "Missing namespace or key" }, { status: 400 });
        await storeDelete(ns, key);
        return Response.json({ ok: true });
      }

      case "store-search": {
        const ns = body.namespace_prefix as string[];
        if (!ns) return Response.json({ error: "Missing namespace_prefix" }, { status: 400 });
        const results = await storeSearch(ns, {
          query: body.query as string | undefined,
          limit: body.limit as number | undefined,
          filter: body.filter as Record<string, unknown> | undefined,
        });
        return Response.json(results);
      }

      case "store-list-namespaces": {
        const ns = await storeListNamespaces(
          body.prefix as string[] | undefined,
          body.suffix as string[] | undefined
        );
        return Response.json({ namespaces: ns });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isDown(msg)) {
      return Response.json(
        {
          error:
            "LangGraph server not running. Start: cd ~/cloudless-agent && langgraph dev --port 2024 --no-browser",
        },
        { status: 503 }
      );
    }
    // Log only static text — never user-supplied action or upstream error content,
    // which could contain newlines that inject fake log lines.
    console.error("[langgraph] action handler threw — check upstream LangGraph server");
    return Response.json({ error: msg }, { status: 500 });
  }
}
