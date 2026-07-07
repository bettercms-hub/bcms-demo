import { useCallback, useEffect, useState } from "react";

/**
 * Client-side project folders for the workspace dashboard.
 *
 * This is prototype-grade organizational state: folders and their
 * project assignments live in localStorage, scoped per workspace. When this
 * app is wired to a real backend, replace load/persist with API calls and keep
 * the same hook surface (createFolder / renameFolder / deleteFolder / move…).
 */

export type Folder = { id: string; name: string };

export type FolderState = {
  folders: Folder[];
  /** projectId -> folderId */
  assignments: Record<string, string>;
};

const EMPTY: FolderState = { folders: [], assignments: {} };

function keyFor(workspace: string) {
  return `bettercms.folders.v1.${workspace}`;
}

function load(workspace: string): FolderState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(keyFor(workspace));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<FolderState>;
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      assignments: parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {},
    };
  } catch {
    return EMPTY;
  }
}

let seq = 0;
function newId() {
  seq += 1;
  return `fld_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export function useFolders(workspace: string) {
  const [state, setState] = useState<FolderState>(() => load(workspace));

  // Reload when the workspace changes.
  useEffect(() => {
    setState(load(workspace));
  }, [workspace]);

  // Persist on every change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(keyFor(workspace), JSON.stringify(state));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [workspace, state]);

  const createFolder = useCallback((name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = newId();
    setState((s) => ({ ...s, folders: [...s.folders, { id, name: trimmed }] }));
    return id;
  }, []);

  const renameFolder = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((s) => ({
      ...s,
      folders: s.folders.map((f) => (f.id === id ? { ...f, name: trimmed } : f)),
    }));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setState((s) => {
      const assignments: Record<string, string> = {};
      for (const [pid, fid] of Object.entries(s.assignments)) {
        if (fid !== id) assignments[pid] = fid;
      }
      return { folders: s.folders.filter((f) => f.id !== id), assignments };
    });
  }, []);

  const moveToFolder = useCallback((projectIds: string | string[], folderId: string | null) => {
    const ids = Array.isArray(projectIds) ? projectIds : [projectIds];
    setState((s) => {
      const assignments = { ...s.assignments };
      for (const pid of ids) {
        if (folderId === null) delete assignments[pid];
        else assignments[pid] = folderId;
      }
      return { ...s, assignments };
    });
  }, []);

  return {
    folders: state.folders,
    assignments: state.assignments,
    createFolder,
    renameFolder,
    deleteFolder,
    moveToFolder,
  };
}
