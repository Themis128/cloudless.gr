"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import type { Workspace } from "@/app/api/admin/workspaces/route";

const LS_KEY = "cloudless_workspace_id";
/** Mirrors `WORKSPACE_COOKIE` in src/lib/workspace-server.ts. */
const COOKIE_KEY = "cloudless_workspace_id";
/** Keep cookies for 30 days. Refreshed every switchTo(). */
const COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;

interface WorkspaceContextValue {
  workspaces: Workspace[];
  current: Workspace | null;
  loaded: boolean;
  switchTo: (id: string) => void;
  setWorkspaces: (ws: Workspace[]) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  current: null,
  loaded: false,
  switchTo: () => {},
  setWorkspaces: () => {},
});

/** Set the cookie that server code (`getActiveWorkspaceId`) reads. Mirrors
 *  what the workspaces POST route sets when a workspace is created. */
function writeCookie(id: string): void {
  // SameSite=Lax + Secure + 30-day expiry. Not HttpOnly because we also want
  // the client to be able to clear/inspect; the SSM read is the source of
  // truth, not the cookie value itself.
  document.cookie =
    `${COOKIE_KEY}=${encodeURIComponent(id)}; ` +
    `path=/; max-age=${COOKIE_MAX_AGE_S}; SameSite=Lax; Secure`;
}

export function WorkspaceProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
     
    if (stored) setCurrentId(stored);
  }, []);

  useEffect(() => {
    fetchWithAuth("/api/admin/workspaces")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: any) => {
        if (data?.workspaces?.length) {
          setWorkspaces(data.workspaces as Workspace[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  // Auto-select first workspace once the list arrives if nothing is selected.
  useEffect(() => {
    if (currentId || workspaces.length === 0) return;
    const stored = localStorage.getItem(LS_KEY);
    const valid = workspaces.some((w) => w.id === stored) ? stored : (workspaces[0]?.id ?? null);
    if (valid) {
       
      setCurrentId(valid);
      localStorage.setItem(LS_KEY, valid);
      writeCookie(valid);
    }
  }, [workspaces, currentId]);

  // Cross-tab sync — if another tab calls switchTo, the storage event fires
  // here so this tab updates its current id without a reload. Per the
  // `useSyncExternalStore` / storage-event pattern that's standard for
  // localStorage-backed shared state.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== LS_KEY || e.newValue === null) return;
      setCurrentId(e.newValue);
    }
    globalThis.addEventListener("storage", onStorage);
    return () => globalThis.removeEventListener("storage", onStorage);
  }, []);

  const switchTo = useCallback((id: string) => {
    setCurrentId(id);
    localStorage.setItem(LS_KEY, id);
    writeCookie(id);
  }, []);

  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null;

  const value = useMemo(
    () => ({ workspaces, current, loaded, switchTo, setWorkspaces }),
    [workspaces, current, loaded, switchTo, setWorkspaces]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
