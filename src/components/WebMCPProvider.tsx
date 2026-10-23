"use client";

import { useEffect } from "react";

interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * The experimental WebMCP API (not yet in lib.dom). Current drafts expose
 * `document.modelContext.registerTool()`; older Chrome builds put it on
 * `navigator.modelContext`, and the earliest shape was
 * `window.modelContext.provideContext()`. Feature-detect all three.
 */
interface ModelContext {
  registerTool?: (tool: WebMCPTool, options?: { signal?: AbortSignal }) => Promise<unknown>;
  provideContext?: (context: { tools: WebMCPTool[] }) => void;
}
interface WebMCPTargets {
  document?: { modelContext?: ModelContext };
  navigator?: { modelContext?: ModelContext };
  window?: { modelContext?: ModelContext };
}

const TOOLS: WebMCPTool[] = [
  {
    name: "book_consultation",
    description: "Book a consultation call with Cloudless.gr",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "User email address" },
        date: { type: "string", description: "Requested date (ISO 8601)" },
        time: { type: "string", description: "Requested time (ISO 8601)" },
      },
      required: ["email", "date", "time"],
    },
    execute: async (args: Record<string, unknown>) => {
      const res = await fetch("/api/calendar/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      return res.ok ? { success: true } : { success: false, error: await res.text() };
    },
  },
  {
    name: "check_availability",
    description: "Check available consultation slots",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date to check (YYYY-MM-DD)" },
      },
      required: ["date"],
    },
    execute: async (args: Record<string, unknown>) => {
      const res = await fetch(`/api/calendar/availability?date=${args.date}`);
      return res.ok ? await res.json() : { error: await res.text() };
    },
  },
];

export default function WebMCPProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = { document, navigator, window } as unknown as WebMCPTargets;
    const mc = t.document?.modelContext ?? t.navigator?.modelContext ?? t.window?.modelContext;
    if (!mc) return;

    if (mc.registerTool) {
      const controller = new AbortController();
      for (const tool of TOOLS) {
        // registerTool returns Promise in the current draft but void in some
        // early builds — Promise.resolve keeps .catch safe either way.
        Promise.resolve(mc.registerTool(tool, { signal: controller.signal })).catch(() => {});
      }
      return () => controller.abort();
    }
    mc.provideContext?.({ tools: TOOLS });
  }, []);

  return null; // This component doesn't render anything
}
