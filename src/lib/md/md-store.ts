/**
 * md-store — the Markdown delivery surface, per project.
 *
 * Holds what the serializers cannot derive: which surfaces are on
 * (llms.txt, llms-full.txt), which pages and entries are excluded from
 * markdown delivery, and the standalone .md files a team writes by hand
 * (guides, agent instructions, anything that is markdown-first).
 *
 * Pages and entries themselves stay structured; their markdown twins are
 * serialized on request. In-memory for the demo, per project in the
 * backend for production.
 */
import { useSyncExternalStore } from "react";

export interface MdFile {
  id: string;
  /** Site path, always ending in .md, e.g. "/docs/getting-started.md". */
  path: string;
  title: string;
  body: string;
  updatedAt: number;
}

export interface MdState {
  /** Serve /llms.txt, the markdown index. */
  llms: boolean;
  /** Serve /llms-full.txt, the full corpus. Heavy, off by default. */
  llmsFull: boolean;
  /** Page paths and entry ids excluded from markdown delivery. */
  excluded: string[];
  files: MdFile[];
}

const byProject = new Map<string, MdState>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let seq = 0;
const newFileId = () => `md_${Date.now().toString(36)}${(seq++).toString(36)}`;

const SEED_FILE_BODY = `---
title: "Getting started"
audience: "agents and developers"
---

# Getting started

This site serves every page as markdown. Append \`.md\` to any path, or send
\`Accept: text/markdown\` on the canonical URL.

## Endpoints

- \`/llms.txt\` lists everything worth reading, with one-line descriptions.
- \`{path}.md\` returns any page as clean markdown with frontmatter.

## Notes for agents

Content here is the same as the HTML, serialized from the same source.
Prefer the markdown endpoints; they are a fraction of the tokens.
`;

function seed(): MdState {
  return {
    llms: true,
    llmsFull: false,
    excluded: [],
    files: [
      {
        id: newFileId(),
        path: "/docs/getting-started.md",
        title: "Getting started",
        body: SEED_FILE_BODY,
        updatedAt: Date.now() - 3 * 86_400_000,
      },
    ],
  };
}

function ensure(projectId: string): MdState {
  let s = byProject.get(projectId);
  if (!s) {
    s = seed();
    byProject.set(projectId, s);
  }
  return s;
}

export function useMdState(projectId: string): MdState {
  return useSyncExternalStore(
    subscribe,
    () => ensure(projectId),
    () => ensure(projectId),
  );
}
export function getMdState(projectId: string): MdState {
  return ensure(projectId);
}

function patch(projectId: string, fn: (s: MdState) => MdState) {
  byProject.set(projectId, fn(ensure(projectId)));
  emit();
}

/** Normalize a user-typed path into "/segment/name.md". */
export function normalizeMdPath(raw: string): string {
  let p = raw.trim().replace(/\s+/g, "-").toLowerCase();
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/+/g, "/").replace(/[^a-z0-9/._-]/g, "");
  if (!p.endsWith(".md")) p = `${p}.md`;
  return p;
}

export const mdActions = {
  setSurface(projectId: string, surface: "llms" | "llmsFull", on: boolean) {
    patch(projectId, (s) => ({ ...s, [surface]: on }));
  },
  /** Toggle a page path or entry id in or out of markdown delivery. */
  toggleExcluded(projectId: string, key: string) {
    patch(projectId, (s) => ({
      ...s,
      excluded: s.excluded.includes(key) ? s.excluded.filter((x) => x !== key) : [...s.excluded, key],
    }));
  },
  addFile(projectId: string, input: { path: string; title: string; body: string }): MdFile {
    const file: MdFile = { ...input, path: normalizeMdPath(input.path), id: newFileId(), updatedAt: Date.now() };
    patch(projectId, (s) => ({ ...s, files: [...s.files, file] }));
    return file;
  },
  updateFile(projectId: string, id: string, input: Partial<Pick<MdFile, "path" | "title" | "body">>) {
    patch(projectId, (s) => ({
      ...s,
      files: s.files.map((f) =>
        f.id === id ? { ...f, ...input, path: input.path ? normalizeMdPath(input.path) : f.path, updatedAt: Date.now() } : f,
      ),
    }));
  },
  removeFile(projectId: string, id: string) {
    patch(projectId, (s) => ({ ...s, files: s.files.filter((f) => f.id !== id) }));
  },
};
