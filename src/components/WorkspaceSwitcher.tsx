"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { Workspace } from "@/app/api/admin/workspaces/route";

export default function WorkspaceSwitcher() {
  const { workspaces, current, switchTo, setWorkspaces } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loaded) return;
    fetchWithAuth("/api/admin/workspaces")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.workspaces?.length) {
          setWorkspaces(data.workspaces as Workspace[]);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [loaded, setWorkspaces]);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!loaded || workspaces.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-void/60 px-3 py-2 text-left transition hover:border-slate-700"
      >
        <div className="min-w-0">
          <p className="font-mono truncate text-xs text-white">
            {current?.name ?? "Select workspace"}
          </p>
          {current?.slug && (
            <p className="font-mono truncate text-[10px] text-slate-600">
              {current.slug}
            </p>
          )}
        </div>
        <svg
          className={`h-3 w-3 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-slate-800 bg-[#0a0a0f] shadow-xl">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => {
                switchTo(ws.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition ${
                ws.id === current?.id
                  ? "bg-neon-magenta/10 text-neon-magenta"
                  : "text-slate-300 hover:bg-void-lighter/40 hover:text-white"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${ws.id === current?.id ? "bg-neon-magenta" : "bg-slate-600"}`}
              />
              <span className="font-mono truncate text-xs">{ws.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
