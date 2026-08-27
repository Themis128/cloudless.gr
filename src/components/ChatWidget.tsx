"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function newId() {
  return globalThis.crypto.randomUUID();
}

const SUGGESTIONS = [
  "What services do you offer?",
  "How much does it cost?",
  "How fast do I see results?",
  "Book a free audit",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "initial-assistant-msg",
      role: "assistant",
      content:
        "Hi! I'm the Cloudless assistant. Ask me anything about our cloud, serverless, or AI marketing services.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  function replaceLastAssistant(content: string) {
    setMessages((prev) => {
      const last = prev.at(-1);
      if (!last) return prev;
      return [...prev.slice(0, -1), { id: last.id, role: "assistant", content }];
    });
  }

  function appendToLastAssistant(text: string) {
    setMessages((prev) => {
      const last = prev.at(-1);
      if (!last) return prev;
      return [
        ...prev.slice(0, -1),
        { id: last.id, role: "assistant", content: last.content + text },
      ];
    });
  }

  async function consumeStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      if (handleSseLines(lines)) break;
    }
  }

  function handleSseLines(lines: string[]): boolean {
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return true;
      try {
        const { text } = JSON.parse(data) as { text: string };
        appendToLastAssistant(text);
      } catch {
        // skip malformed chunk
      }
    }
    return false;
  }

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    const userMsg: Message = {
      id: newId(),
      role: "user",
      content: text.trim(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);
    setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok || !res.body) {
        replaceLastAssistant("Sorry, I'm unavailable right now. Please use the Contact page.");
        return;
      }

      await consumeStream(res.body.getReader());
    } catch {
      replaceLastAssistant("Connection error. Please try the Contact page.");
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <>
      {/* Floating button — lifts above cookie banner via --cookie-banner-h */}
      <button
        type="button"
        aria-label={open ? "Close chat" : "Open chat assistant"}
        onClick={() => setOpen((o) => !o)}
        className="border-neon-green/30 bg-void shadow-neon-green/10 hover:border-neon-green/60 hover:shadow-neon-green/20 fixed right-4 bottom-[calc(1.5rem+var(--cookie-banner-h,0px))] z-50 flex h-14 min-h-14 w-14 min-w-14 items-center justify-center rounded-full border shadow-lg transition-all sm:right-6"
      >
        <span className="text-xl" aria-hidden="true">
          {open ? "\u2715" : "\u{1F4AC}"}
        </span>
      </button>

      {/* Chat panel */}
      {open && (
        <div
          data-testid="chat-panel"
          className="bg-void fixed right-4 bottom-[calc(5.5rem+var(--cookie-banner-h,0px))] left-4 z-50 flex max-h-[min(28rem,70dvh)] w-auto max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 shadow-2xl sm:right-6 sm:left-auto sm:w-96"
        >
          {/* Header */}
          <div className="bg-void-light flex items-center gap-3 border-b border-slate-800 px-4 py-3">
            <span className="bg-neon-green h-2.5 w-2.5 animate-pulse rounded-full" />
            <div>
              <div className="font-heading text-sm font-semibold text-white">
                Cloudless Assistant
              </div>
              <div className="font-mono text-xs text-slate-500">Powered by Workers AI</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`font-body max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-neon-green/10 border-neon-green/20 border text-white"
                      : "bg-void-light border border-slate-800 text-slate-300"
                  }`}
                >
                  {m.content ? (
                    m.role === "assistant" ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ children }) => (
                            <div className="my-2 overflow-x-auto">
                              <table className="w-full border-collapse font-mono text-xs">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="border-b border-slate-600">{children}</thead>,
                          th: ({ children }) => <th className="px-2 py-1 text-left text-slate-400 font-semibold">{children}</th>,
                          td: ({ children }) => <td className="px-2 py-1 text-slate-300 border-b border-slate-800/60">{children}</td>,
                          tr: ({ children }) => <tr className="hover:bg-slate-800/30">{children}</tr>,
                          strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    ) : (
                      m.content
                    )
                  ) : (
                    <span className="inline-flex gap-1">
                      <span className="animate-bounce text-slate-500">●</span>
                      <span
                        className="animate-bounce text-slate-500"
                        style={{ animationDelay: "0.1s" }}
                      >
                        ●
                      </span>
                      <span
                        className="animate-bounce text-slate-500"
                        style={{ animationDelay: "0.2s" }}
                      >
                        ●
                      </span>
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only on first turn) */}
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 border-t border-slate-800 px-4 py-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="hover:border-neon-green/40 min-h-11 rounded-full border border-slate-700 px-3 py-2 font-mono text-xs text-slate-400 transition hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="bg-void-light flex items-center gap-2 border-t border-slate-800 px-3 py-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder="Ask anything…"
              className="min-h-11 flex-1 bg-transparent font-mono text-sm text-white placeholder-slate-600 outline-none disabled:opacity-50"
              maxLength={500}
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              className="border-neon-green/30 text-neon-green hover:border-neon-green/60 min-h-11 shrink-0 rounded-lg border px-3 py-2 font-mono text-xs transition disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
