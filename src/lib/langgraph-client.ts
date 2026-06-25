/**
 * LangGraph Agent Server client
 *
 * Wraps @langchain/langgraph-sdk pointing at the local cloudless-agent
 * server (port 2024). Implements the full Agent Server protocol v2:
 * threads, runs (streaming + background), store, and interrupt/resume.
 */

import { Client } from "@langchain/langgraph-sdk";
import type {
  Thread,
  ThreadState,
  Run,
  Assistant,
} from "@langchain/langgraph-sdk";

export type { Thread, ThreadState, Run, Assistant };

const LANGGRAPH_URL = process.env.LANGGRAPH_URL ?? "http://localhost:2024";
const CLOUDLESS_GRAPH_ID = "cloudless";

function getClient(): Client {
  return new Client({ apiUrl: LANGGRAPH_URL });
}

// ── Assistants ────────────────────────────────────────────────────────────────

export async function getCloudlessAssistant(): Promise<Assistant> {
  const client = getClient();
  const assistants = await client.assistants.search({
    graphId: CLOUDLESS_GRAPH_ID,
    limit: 1,
  });
  if (assistants.length === 0)
    throw new Error("cloudless assistant not found on LangGraph server");
  return assistants[0];
}

export async function listAssistants(graphId?: string): Promise<Assistant[]> {
  return getClient().assistants.search({ graphId, limit: 100 });
}

// ── Threads ───────────────────────────────────────────────────────────────────

export async function createLangGraphThread(metadata?: Record<string, unknown>): Promise<Thread> {
  return getClient().threads.create({ metadata });
}

export async function getLangGraphThread(threadId: string): Promise<Thread> {
  return getClient().threads.get(threadId);
}

export async function patchLangGraphThread(
  threadId: string,
  metadata: Record<string, unknown>
): Promise<Thread> {
  return getClient().threads.update(threadId, { metadata });
}

export async function getLangGraphThreadState(threadId: string): Promise<ThreadState> {
  return getClient().threads.getState(threadId);
}

export async function updateLangGraphThreadState(
  threadId: string,
  values: Record<string, unknown>,
  asNode?: string
): Promise<void> {
  await getClient().threads.updateState(threadId, { values, asNode });
}

export async function deleteLangGraphThread(threadId: string): Promise<void> {
  return getClient().threads.delete(threadId);
}

export async function searchLangGraphThreads(
  limit = 20,
  metadata?: Record<string, unknown>,
  status?: "idle" | "busy" | "interrupted" | "error"
): Promise<Thread[]> {
  return getClient().threads.search({ limit, metadata, status });
}

export async function getLangGraphThreadHistory(threadId: string, limit = 10) {
  return getClient().threads.getHistory(threadId, { limit });
}

// ── Runs — streaming ──────────────────────────────────────────────────────────

export interface StreamRunOptions {
  streamMode?: ("messages" | "updates" | "values" | "events" | "debug" | "custom")[];
  interruptBefore?: string[] | "*";
  interruptAfter?: string[] | "*";
  onDisconnect?: "cancel" | "continue";
  multitaskStrategy?: "reject" | "rollback" | "interrupt" | "enqueue";
  ifNotExists?: "create" | "reject";
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
  command?: {
    update?: Record<string, unknown>;
    resume?: unknown;
    goto?: string | string[];
  };
}

/**
 * Stream a run — returns the raw upstream Response with SSE body.
 * The API route pipes this directly to the browser.
 */
export async function streamLangGraphRun(
  threadId: string,
  assistantId: string,
  messages: Array<{ role: string; content: string }>,
  opts: StreamRunOptions = {}
): Promise<Response> {
  const url = `${LANGGRAPH_URL}/threads/${encodeURIComponent(threadId)}/runs/stream`;
  const body: Record<string, unknown> = {
    assistant_id: assistantId,
    stream_mode: opts.streamMode ?? ["messages"],
    on_disconnect: opts.onDisconnect ?? "continue",
    multitask_strategy: opts.multitaskStrategy ?? "enqueue",
    if_not_exists: opts.ifNotExists ?? "reject",
  };
  if (messages.length > 0) body.input = { messages };
  if (opts.command) body.command = opts.command;
  if (opts.interruptBefore) body.interrupt_before = opts.interruptBefore;
  if (opts.interruptAfter) body.interrupt_after = opts.interruptAfter;
  if (opts.metadata) body.metadata = opts.metadata;
  if (opts.config) body.config = opts.config;

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
}

// ── Runs — background (fire-and-forget) ──────────────────────────────────────

export async function createBackgroundRun(
  threadId: string,
  assistantId: string,
  messages: Array<{ role: string; content: string }>,
  opts: Pick<StreamRunOptions, "multitaskStrategy" | "metadata" | "config" | "interruptBefore" | "interruptAfter"> = {}
): Promise<Run> {
  return getClient().runs.create(threadId, assistantId, {
    input: { messages },
    multitaskStrategy: opts.multitaskStrategy ?? "enqueue",
    metadata: opts.metadata,
    config: opts.config,
    interruptBefore: opts.interruptBefore,
    interruptAfter: opts.interruptAfter,
  });
}

export async function joinRunStream(threadId: string, runId: string): Promise<Response> {
  const url = `${LANGGRAPH_URL}/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}/stream`;
  return fetch(url, { signal: AbortSignal.timeout(120_000) });
}

export async function cancelRun(threadId: string, runId: string, wait = false): Promise<void> {
  await getClient().runs.cancel(threadId, runId, wait);
}

export async function listRuns(threadId: string, limit = 20): Promise<Run[]> {
  return getClient().runs.list(threadId, { limit });
}

export async function getRun(threadId: string, runId: string): Promise<Run> {
  return getClient().runs.get(threadId, runId);
}

// ── Runs — blocking (wait for output) ────────────────────────────────────────

export async function invokeLangGraphRun(
  threadId: string,
  assistantId: string,
  messages: Array<{ role: string; content: string }>,
  opts: Pick<StreamRunOptions, "config" | "metadata"> = {}
) {
  return getClient().runs.wait(threadId, assistantId, {
    input: { messages },
    config: opts.config,
    metadata: opts.metadata,
  });
}

// ── Store (cross-thread persistent memory) ────────────────────────────────────

export async function storeGet(namespace: string[], key: string) {
  return getClient().store.getItem(namespace, key);
}

export async function storePut(namespace: string[], key: string, value: Record<string, unknown>) {
  return getClient().store.putItem(namespace, key, value);
}

export async function storeDelete(namespace: string[], key: string) {
  return getClient().store.deleteItem(namespace, key);
}

export async function storeSearch(
  namespacePrefix: string[],
  opts: { query?: string; limit?: number; filter?: Record<string, unknown> } = {}
) {
  return getClient().store.searchItems(namespacePrefix, opts);
}

export async function storeListNamespaces(
  prefix?: string[],
  suffix?: string[]
) {
  return getClient().store.listNamespaces({ prefix, suffix });
}

// ── Human-in-the-loop resume ──────────────────────────────────────────────────

/**
 * Resume an interrupted run by injecting a value back into the graph.
 * Uses the Command API: POST /threads/{id}/runs/stream with command.resume.
 */
export async function resumeInterruptedRun(
  threadId: string,
  assistantId: string,
  resumeValue: unknown,
  streamMode: StreamRunOptions["streamMode"] = ["messages"]
): Promise<Response> {
  return streamLangGraphRun(threadId, assistantId, [], {
    command: { resume: resumeValue },
    streamMode,
  });
}
