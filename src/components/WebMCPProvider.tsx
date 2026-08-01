"use client";

import { useEffect } from "react";

export default function WebMCPProvider() {
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).modelContext) {
      (window as any).modelContext.provideContext({
        tools: [
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
            execute: async (args: any) => {
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
            execute: async (args: any) => {
              const res = await fetch(`/api/calendar/availability?date=${args.date}`);
              return res.ok ? await res.json() : { error: await res.text() };
            },
          },
        ],
      });
      console.log("WebMCP context provided");
    }
  }, []);

  return null; // This component doesn't render anything
}