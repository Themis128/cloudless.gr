"use client";

import { useEffect, useRef, useState } from "react";

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: newId(),
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
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (!last) return copy;
      copy[copy.length - 1] = { id: last.id, role: "assistant", content };
      return copy;
    });
  }

  function appendToLastAssistant(text: string) {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (!last) return copy;
      copy[copy.length - 1] = {
        id: last.id,
        role: "assistant",
        content: last.content + text,
      };
      return copy;
    });
  }

  async function consumeStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ) {
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
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok || !res.body) {
        replaceLastAssistant(
          "Sorry, I'm unavailable right now. Please use the Contact page.",
        );
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
      {/* Floating button */}
      <button
        type="button"
        aria-label={open ? "Close chat" : "Open chat assistant"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-neon-green/30 bg-void shadow-lg shadow-neon-green/10 transition-all hover:border-neon-green/60 hover:shadow-neon-green/20"
      >
        <span className="text-xl">{open ? "✕" : "💬"}</span>
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-80 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-void shadow-2xl sm:w-96">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-800 bg-void-light px-4 py-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neon-green" />
            <div>
              <div className="font-heading text-sm font-semibold text-white">
                Cloudless Assistant
              </div>
              <div className="font-mono text-xs text-slate-500">
                Powered by Claude
              </div>
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
                  className={`max-w-[85%] rounded-xl px-3 py-2 font-body text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-neon-green/10 border border-neon-green/20 text-white"
                      : "bg-void-light border border-slate-800 text-slate-300"
                  }`}
                >
                  {m.content || (
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
                  className="rounded-full border border-slate-700 px-3 py-1 font-mono text-xs text-slate-400 transition hover:border-neon-green/40 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-slate-800 bg-void-light px-3 py-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder="Ask anything…"
              className="flex-1 bg-transparent font-mono text-sm text-white placeholder-slate-600 outline-none disabled:opacity-50"
              maxLength={500}
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              className="flex-shrink-0 rounded-lg border border-neon-green/30 px-3 py-1.5 font-mono text-xs text-neon-green transition hover:border-neon-green/60 disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
