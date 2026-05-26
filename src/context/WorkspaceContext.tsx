"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import type { Workspace } from "@/app/api/admin/workspaces/route";

const LS_KEY = "cloudless_workspace_id";

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

export function WorkspaceProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setCurrentId(stored);
  }, []);

  useEffect(() => {
    fetchWithAuth("/api/admin/workspaces")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentId(valid);
      localStorage.setItem(LS_KEY, valid);
    }
  }, [workspaces, currentId]);

  const switchTo = useCallback((id: string) => {
    setCurrentId(id);
    localStorage.setItem(LS_KEY, id);
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
