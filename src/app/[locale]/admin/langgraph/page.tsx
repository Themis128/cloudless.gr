"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Msg {
  id: string;
  role: "user" | "assistant" | "tool" | "interrupt";
  content: string;
  streaming?: boolean;
  error?: boolean;
  runId?: string;
}

interface Thread {
  thread_id: string;
  created_at: string;
  label?: string;
  status?: string;
}

interface Assistant {
  assistant_id: string;
  graph_id: string;
  name: string;
}

interface Run {
  run_id: string;
  status: string;
  created_at: string;
}

type StreamMode = "messages" | "updates" | "values" | "events" | "debug";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function api(action: string, params: Record<string, unknown> = {}) {
  const res = await fetchWithAuth("/api/admin/ai/langgraph", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res;
}

const SUGGESTIONS = [
  "Get the web analytics",
  "What are the latest KPIs?",
  "Show me the leads",
  "Check cluster health",
  "List active Notion projects",
  "Show subscription stats",
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-500" />;
  return (
    <span
      className={`h-2 w-2 rounded-full ${ok ? "animate-pulse bg-emerald-400" : "bg-red-500"}`}
    />
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const isInterrupt = msg.role === "interrupt";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          isUser
            ? "bg-indigo-500 text-white"
            : isInterrupt
              ? "bg-yellow-700 text-yellow-200"
              : msg.error
                ? "bg-red-900 text-red-300"
                : "bg-violet-700 text-white"
        }`}
      >
        {isUser ? "U" : isInterrupt ? "⏸" : "AI"}
      </div>
      <div className={`flex max-w-[82%] flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-indigo-600 text-white"
              : isInterrupt
                ? "rounded-tl-sm bg-yellow-900/30 text-yellow-300 ring-1 ring-yellow-700/40"
                : msg.error
                  ? "rounded-tl-sm bg-red-900/30 text-red-300 ring-1 ring-red-800/50"
                  : "rounded-tl-sm bg-zinc-800 text-zinc-100"
          }`}
        >
          <pre className="font-sans whitespace-pre-wrap">{msg.content}</pre>
          {msg.streaming && (
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current opacity-70" />
          )}
        </div>
        {msg.runId && (
          <span className="mt-0.5 font-mono text-[9px] text-zinc-700">
            run:{msg.runId.slice(0, 8)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Store Panel ───────────────────────────────────────────────────────────────

function StorePanel() {
  const [ns, setNs] = useState("cloudless");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doGet() {
    setBusy(true);
    setResult(null);
    try {
      const r = await api("store-get", { namespace: [ns], key });
      const d = await r.json();
      setResult(JSON.stringify(d, null, 2));
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }
  async function doPut() {
    setBusy(true);
    setResult(null);
    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(value) as Record<string, unknown>;
      } catch {
        parsed = { value };
      }
      await api("store-put", { namespace: [ns], key, value: parsed });
      setResult("Stored.");
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }
  async function doDel() {
    setBusy(true);
    setResult(null);
    try {
      await api("store-delete", { namespace: [ns], key });
      setResult("Deleted.");
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }
  async function doSearch() {
    setBusy(true);
    setResult(null);
    try {
      const r = await api("store-search", {
        namespace_prefix: [ns],
        query: key || undefined,
        limit: 10,
      });
      const d = await r.json();
      setResult(JSON.stringify(d, null, 2));
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-wider text-zinc-600 uppercase">Cross-thread Store</p>
      <div className="space-y-2">
        <input
          value={ns}
          onChange={(e) => setNs(e.target.value)}
          placeholder="namespace"
          className="w-full rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:ring-1 focus:ring-violet-600 focus:outline-none"
        />
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="key / search query"
          className="w-full rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:ring-1 focus:ring-violet-600 focus:outline-none"
        />
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value (JSON or plain text)"
          rows={2}
          className="w-full resize-none rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:ring-1 focus:ring-violet-600 focus:outline-none"
        />
        <div className="flex gap-1">
          {(["Get", "Put", "Del", "Search"] as const).map((label) => {
            const fn =
              label === "Get"
                ? doGet
                : label === "Put"
                  ? doPut
                  : label === "Del"
                    ? doDel
                    : doSearch;
            return (
              <button
                key={label}
                onClick={() => void fn()}
                disabled={busy}
                className="flex-1 rounded bg-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-600 disabled:opacity-40"
              >
                {label}
              </button>
            );
          })}
        </div>
        {result && (
          <pre className="max-h-32 overflow-y-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Runs Panel ─────────────────────────────────────────────────────────────────

function RunsPanel({ threadId }: { threadId: string | null }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!threadId) return;
    setBusy(true);
    try {
      const r = await api("list-runs", { thread_id: threadId, limit: 10 });
      const d = (await r.json()) as { runs: Run[] };
      setRuns(d.runs ?? []);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!threadId) return <p className="text-[11px] text-zinc-700">Select a thread</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-wider text-zinc-600 uppercase">Run history</p>
        <button
          onClick={() => void load()}
          disabled={busy}
          className="text-[10px] text-zinc-600 hover:text-zinc-400"
        >
          ↺
        </button>
      </div>
      {runs.length === 0 && <p className="text-[11px] text-zinc-700">No runs yet</p>}
      {runs.map((r) => (
        <div key={r.run_id} className="rounded bg-zinc-800/60 px-2 py-1.5 text-[10px]">
          <span
            className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
              r.status === "success"
                ? "bg-emerald-400"
                : r.status === "error"
                  ? "bg-red-400"
                  : r.status === "pending"
                    ? "animate-pulse bg-yellow-400"
                    : "bg-zinc-500"
            }`}
          />
          <span className="font-mono text-zinc-500">{r.run_id.slice(0, 8)}</span>
          <span className={`ml-1 ${r.status === "error" ? "text-red-400" : "text-zinc-500"}`}>
            {r.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LangGraphPage() {
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "store" | "runs">("chat");
  const [streamMode, setStreamMode] = useState<StreamMode>("messages");
  const [interruptedRunId, setInterruptedRunId] = useState<string | null>(null);
  const [resumeInput, setResumeInput] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void init();
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function init() {
    try {
      const res = await api("health");
      const h = (await res.json()) as { ok: boolean };
      setServerOk(h.ok);
      if (!h.ok) return;
      const [ares, tres] = await Promise.all([
        api("get-assistant"),
        api("list-threads", { limit: 30 }),
      ]);
      setAssistant((await ares.json()) as Assistant);
      const td = (await tres.json()) as { threads: Thread[] };
      setThreads(td.threads ?? []);
    } catch {
      setServerOk(false);
    }
  }

  async function newThread() {
    const res = await api("create-thread");
    const t = (await res.json()) as Thread;
    setThreads((prev) => [t, ...prev]);
    setActiveThreadId(t.thread_id);
    setMessages([]);
    setInterruptedRunId(null);
    inputRef.current?.focus();
  }

  async function switchThread(id: string) {
    if (id === activeThreadId) return;
    setActiveThreadId(id);
    setInterruptedRunId(null);
    setBusy(true);
    try {
      const res = await api("get-thread-state", { thread_id: id });
      const state = (await res.json()) as {
        values?: { messages?: Array<{ type: string; content: string }> };
        next?: string[];
      };
      const msgs: Msg[] = (state.values?.messages ?? [])
        .filter((m) => m.type === "human" || m.type === "ai")
        .map((m) => ({
          id: uid(),
          role: m.type === "human" ? "user" : "assistant",
          content: m.content ?? "",
        }));

      if (state.next?.length) {
        msgs.push({
          id: uid(),
          role: "interrupt",
          content: `⏸ Paused before: ${state.next.join(", ")}`,
        });
        setInterruptedRunId("pending");
      }
      setMessages(msgs);
    } catch {
      setMessages([]);
    } finally {
      setBusy(false);
    }
  }

  async function deleteThread(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await api("delete-thread", { thread_id: id });
    } catch {
      /* best effort */
    }
    setThreads((prev) => prev.filter((t) => t.thread_id !== id));
    if (activeThreadId === id) {
      setActiveThreadId(null);
      setMessages([]);
    }
  }

  const send = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || busy || !serverOk || !assistant) return;

      let tid = activeThreadId;
      if (!tid) {
        const res = await api("create-thread");
        const t = (await res.json()) as Thread;
        t.label = text.slice(0, 45);
        setThreads((prev) => [t, ...prev]);
        setActiveThreadId(t.thread_id);
        tid = t.thread_id;
      } else {
        setThreads((prev) =>
          prev.map((t) =>
            t.thread_id === tid && !t.label ? { ...t, label: text.slice(0, 45) } : t
          )
        );
      }

      const userMsg: Msg = { id: uid(), role: "user", content: text };
      const asstMsg: Msg = { id: uid(), role: "assistant", content: "", streaming: true };
      setMessages((prev) => [...prev, userMsg, asstMsg]);
      setInput("");
      setInterruptedRunId(null);
      setBusy(true);

      try {
        const res = await api("stream-run", {
          thread_id: tid,
          assistant_id: assistant.assistant_id,
          messages: [{ role: "user", content: text }],
          stream_mode: [streamMode],
          on_disconnect: "continue",
          multitask_strategy: "enqueue",
        });

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream body");

        const dec = new TextDecoder();
        let buf = "";
        let latestContent = "";
        let runId = "";
        let interrupted = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]" || !raw) continue;
            try {
              const parsed = JSON.parse(raw) as unknown;
              const obj = parsed as Record<string, unknown>;

              if (obj.run_id && typeof obj.run_id === "string") runId = obj.run_id;

              if (streamMode === "messages" && Array.isArray(parsed)) {
                const chunk = (parsed as Array<Record<string, unknown>>)[0];
                if (chunk?.content && typeof chunk.content === "string") {
                  latestContent = chunk.content;
                }
              } else if (
                streamMode === "updates" &&
                typeof parsed === "object" &&
                parsed !== null
              ) {
                const updates = parsed as Record<
                  string,
                  { messages?: Array<{ content?: string }> }
                >;
                const responder = updates.responder;
                if (responder?.messages?.length) {
                  const last = responder.messages[responder.messages.length - 1];
                  if (last?.content) latestContent = last.content;
                }
              }

              if (obj.type === "interrupt") interrupted = true;

              if (latestContent) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === asstMsg.id ? { ...m, content: latestContent, runId } : m
                  )
                );
              }
            } catch {
              /* skip malformed */
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === asstMsg.id ? { ...m, streaming: false } : m))
        );

        if (interrupted) {
          setInterruptedRunId(runId || "pending");
          setMessages((prev) => [
            ...prev,
            { id: uid(), role: "interrupt", content: "⏸ Run paused — waiting for input" },
          ]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsg.id ? { ...m, content: msg, streaming: false, error: true } : m
          )
        );
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [input, busy, serverOk, assistant, activeThreadId, streamMode]
  );

  async function sendResume() {
    if (!activeThreadId || !assistant || !interruptedRunId || !resumeInput.trim()) return;
    setBusy(true);
    const asstMsg: Msg = { id: uid(), role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, asstMsg]);
    try {
      const res = await api("resume-run", {
        thread_id: activeThreadId,
        assistant_id: assistant.assistant_id,
        resume_value: resumeInput.trim(),
        stream_mode: [streamMode],
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream body");
      const dec = new TextDecoder();
      let buf = "";
      let latestContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const parsed = JSON.parse(raw) as unknown;
            if (Array.isArray(parsed)) {
              const chunk = (parsed as Array<Record<string, unknown>>)[0];
              if (chunk?.content && typeof chunk.content === "string")
                latestContent = chunk.content;
            }
            if (latestContent)
              setMessages((prev) =>
                prev.map((m) => (m.id === asstMsg.id ? { ...m, content: latestContent } : m))
              );
          } catch {
            /* skip */
          }
        }
      }
      setInterruptedRunId(null);
      setResumeInput("");
      setMessages((prev) =>
        prev.map((m) => (m.id === asstMsg.id ? { ...m, streaming: false } : m))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstMsg.id ? { ...m, content: msg, streaming: false, error: true } : m
        )
      );
    } finally {
      setBusy(false);
    }
  }

  const isOffline = serverOk === false;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-zinc-950 text-zinc-100">
      {/* ── Sidebar ── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4 py-3">
          <StatusDot ok={serverOk} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">LangGraph Agent</p>
            <p className="truncate text-[10px] text-zinc-500">
              {assistant
                ? `${assistant.graph_id} · ${assistant.assistant_id.slice(0, 8)}`
                : isOffline
                  ? "Server offline"
                  : "…"}
            </p>
          </div>
          <button
            onClick={() => void init()}
            className="text-zinc-600 hover:text-zinc-300"
            title="Refresh"
          >
            ↺
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {(["chat", "store", "runs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-[10px] tracking-wider uppercase transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-violet-500 text-violet-300"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === "chat" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-wider text-zinc-600 uppercase">Threads</span>
                <button
                  onClick={() => void newThread()}
                  disabled={isOffline}
                  className="rounded px-1 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-40"
                >
                  ＋
                </button>
              </div>
              <div className="space-y-0.5">
                {threads.length === 0 && (
                  <p className="text-[11px] text-zinc-700">No threads yet</p>
                )}
                {threads.map((t) => (
                  <button
                    key={t.thread_id}
                    onClick={() => void switchThread(t.thread_id)}
                    className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                      t.thread_id === activeThreadId
                        ? "bg-violet-900/50 text-white"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    <span className="truncate">
                      {t.label ?? `Thread ${t.thread_id.slice(0, 8)}`}
                    </span>
                    <span
                      onClick={(e) => void deleteThread(e, t.thread_id)}
                      className="ml-1 shrink-0 rounded p-0.5 text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-zinc-600 hover:text-zinc-300"
                    >
                      ✕
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <p className="mb-1 text-[10px] tracking-wider text-zinc-600 uppercase">
                  Stream mode
                </p>
                <select
                  value={streamMode}
                  onChange={(e) => setStreamMode(e.target.value as StreamMode)}
                  className="w-full rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:ring-1 focus:ring-violet-600 focus:outline-none"
                >
                  <option value="messages">messages (default)</option>
                  <option value="updates">updates (graph state)</option>
                  <option value="values">values (full state)</option>
                  <option value="events">events (all events)</option>
                  <option value="debug">debug (verbose)</option>
                </select>
              </div>

              <div className="pt-1">
                <p className="mb-1.5 text-[10px] tracking-wider text-zinc-600 uppercase">Tools</p>
                {[
                  ["📊", "Analytics"],
                  ["📄", "Top pages"],
                  ["🔑", "Keywords"],
                  ["👥", "Leads"],
                  ["📝", "Projects"],
                  ["📈", "KPIs"],
                  ["🖥", "Cluster"],
                  ["📬", "Subscriptions"],
                ].map(([i, l]) => (
                  <div
                    key={l}
                    className="flex items-center gap-1.5 py-0.5 text-[11px] text-zinc-600"
                  >
                    <span>{i}</span>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "store" && <StorePanel />}
          {activeTab === "runs" && <RunsPanel threadId={activeThreadId} />}
        </div>

        {isOffline && (
          <div className="border-t border-zinc-800 p-3">
            <p className="mb-1 text-[10px] text-red-400">Server offline</p>
            <code className="block text-[9px] break-all text-zinc-700">
              cd ~/cloudless-agent{"\n"}langgraph dev --port 2024 --no-browser --no-reload
            </code>
          </div>
        )}
      </aside>

      {/* ── Chat ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="mb-1 text-3xl">🤖</p>
              <p className="mb-1 text-sm font-semibold text-zinc-200">Cloudless.gr Agent</p>
              <p className="mb-6 text-xs text-zinc-600">
                Ask about analytics, leads, projects, or infrastructure.
              </p>
              <div className="grid max-w-lg grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    disabled={isOffline}
                    className="rounded-xl border border-zinc-800 px-3 py-2 text-left text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-30"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-4">
              {messages.map((m) => (
                <Bubble key={m.id} msg={m} />
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Resume banner for interrupted runs */}
        {interruptedRunId && (
          <div className="border-t border-yellow-900/40 bg-yellow-950/20 px-6 py-3">
            <p className="mb-2 text-xs text-yellow-400">Run paused — provide input to resume:</p>
            <div className="flex gap-2">
              <input
                value={resumeInput}
                onChange={(e) => setResumeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendResume();
                }}
                placeholder="Resume value (e.g. 'yes', JSON, or any text)…"
                className="flex-1 rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:ring-1 focus:ring-yellow-600 focus:outline-none"
              />
              <button
                onClick={() => void sendResume()}
                disabled={busy || !resumeInput.trim()}
                className="rounded bg-yellow-700 px-3 py-1.5 text-xs text-white hover:bg-yellow-600 disabled:opacity-40"
              >
                Resume
              </button>
              <button
                onClick={() => setInterruptedRunId(null)}
                className="rounded px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-zinc-800 bg-zinc-900/60 px-6 py-4">
          <div className="mx-auto max-w-2xl">
            <div
              className={`flex items-end gap-3 rounded-2xl border bg-zinc-800 px-4 py-3 transition-colors ${
                isOffline
                  ? "border-zinc-800 opacity-40"
                  : "border-zinc-700 focus-within:border-violet-600/60"
              }`}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={
                  isOffline ? "LangGraph server offline…" : `Ask anything… (mode: ${streamMode})`
                }
                disabled={isOffline || busy}
                rows={1}
                style={{ minHeight: 24, maxHeight: 160 }}
                className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
              />
              <button
                onClick={() => void send()}
                disabled={!input.trim() || isOffline || busy}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                  >
                    <path
                      d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-zinc-700">
              LangGraph · Qwen2.5-Coder-7B · stream_mode={streamMode}
              {activeThreadId && (
                <span className="ml-2 font-mono text-zinc-800">
                  thread:{activeThreadId.slice(0, 8)}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
