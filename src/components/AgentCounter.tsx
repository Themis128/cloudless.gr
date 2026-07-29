"use client";

import { useState, useEffect, useCallback } from "react";

type CounterAgentResponse = {
  count?: number;
  error?: string;
};

export default function AgentCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const agentUrl = "/api/agents/counter-agent/default";

  const callAgent = useCallback(
    async (method: string): Promise<CounterAgentResponse> => {
      try {
        const response = await fetch(`${agentUrl}?method=${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        const data = (await response.json()) as CounterAgentResponse;
        return data;
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
    [agentUrl]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await callAgent("getCount");
    if (result.error) {
      setError(result.error);
    } else {
      setCount(result.count ?? 0);
    }
    setLoading(false);
  }, [callAgent]);

  async function increment() {
    const result = await callAgent("increment");
    if (result.error) {
      setError(result.error);
    } else {
      setCount(result.count ?? 0);
    }
  }

  async function decrement() {
    const result = await callAgent("decrement");
    if (result.error) {
      setError(result.error);
    } else {
      setCount(result.count ?? 0);
    }
  }

  async function reset() {
    const result = await callAgent("reset");
    if (result.error) {
      setError(result.error);
    } else {
      setCount(result.count ?? 0);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-slate-400">
          Current count:{" "}
          <span className="text-neon-cyan font-bold">{loading ? "loading..." : count}</span>
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void increment()}
          className="hover:border-neon-cyan/50 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-mono text-sm"
          disabled={loading}
        >
          Increment
        </button>
        <button
          onClick={() => void decrement()}
          className="hover:border-neon-cyan/50 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-mono text-sm"
          disabled={loading}
        >
          Decrement
        </button>
        <button
          onClick={() => void reset()}
          className="hover:border-neon-cyan/50 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-mono text-sm"
          disabled={loading}
        >
          Reset
        </button>
        <button
          onClick={() => void refresh()}
          className="hover:border-neon-cyan/50 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-mono text-sm"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && <pre className="text-xs text-red-400">Error: {error}</pre>}
    </div>
  );
}
