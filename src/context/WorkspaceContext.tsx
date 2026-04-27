"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Workspace } from "@/app/api/admin/workspaces/route";

const LS_KEY = "cloudless_workspace_id";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  current: Workspace | null;
  switchTo: (id: string) => void;
  setWorkspaces: (ws: Workspace[]) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  current: null,
  switchTo: () => {},
  setWorkspaces: () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspacesState] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setCurrentId(stored);
  }, []);

  const switchTo = useCallback((id: string) => {
    setCurrentId(id);
    localStorage.setItem(LS_KEY, id);
  }, []);

  const setWorkspaces = useCallback(
    (ws: Workspace[]) => {
      setWorkspacesState(ws);
      // Auto-select first if nothing selected yet
      if (!currentId && ws.length > 0) {
        const stored = localStorage.getItem(LS_KEY);
        const valid = ws.find((w) => w.id === stored) ? stored : ws[0].id;
        if (valid) {
          setCurrentId(valid);
          localStorage.setItem(LS_KEY, valid);
        }
      }
    },
    [currentId],
  );

  const current =
    workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null;

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, current, switchTo, setWorkspaces }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
