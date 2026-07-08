/**
 * md-store — the Markdown delivery surface, per project.
 *
 * Holds what the serializers cannot derive: which surfaces are on
 * (llms.txt, llms-full.txt), whether llms.txt is auto-generated or a
 * hand-authored override, which pages and entries are excluded from
 * markdown delivery, and the standalone .md files a team writes by hand.
 *
 * Standalone files carry their own draft/published lifecycle: drafts are
 * private, published files are live and appear in llms.txt. Pages and
 * entries stay structured; their markdown twins are serialized on request.
 * In-memory for the demo, per project in the backend for production.
 */
import { useSyncExternalStore } from "react";

export type MdFileState = "draft" | "published";

export interface MdFile {
  id: string;
  /** Site path, always ending in .md, e.g. "/docs/getting-started.md". */
  path: string;
  title: string;
  body: string;
  state: MdFileState;
  updatedAt: number;
}

export interface MdState {
  /** Serve /llms.txt, the markdown index. */
  llms: boolean;
  /** Serve /llms-full.txt, the full corpus. Heavy, off by default. */
  llmsFull: boolean;
  /** "auto" generates llms.txt from the site; "custom" serves llmsCustom. */
  llmsMode: "auto" | "custom";
  /** Hand-authored llms.txt, used when llmsMode is "custom". */
  llmsCustom: string;
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
    llmsMode: "auto",
    llmsCustom: "",
    excluded: [],
    files: [
      {
        id: newFileId(),
        path: "/docs/getting-started.md",
        title: "Getting started",
        body: SEED_FILE_BODY,
        state: "published",
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
  /** Switch llms.txt to a hand-authored override (or back to auto). */
  setLlmsMode(projectId: string, mode: "auto" | "custom", custom?: string) {
    patch(projectId, (s) => ({ ...s, llmsMode: mode, llmsCustom: custom ?? s.llmsCustom }));
  },
  /** Toggle a page path or entry id in or out of markdown delivery. */
  toggleExcluded(projectId: string, key: string) {
    patch(projectId, (s) => ({
      ...s,
      excluded: s.excluded.includes(key) ? s.excluded.filter((x) => x !== key) : [...s.excluded, key],
    }));
  },
  addFile(projectId: string, input: { path: string; title: string; body: string; state?: MdFileState }): MdFile {
    const file: MdFile = {
      path: normalizeMdPath(input.path),
      title: input.title,
      body: input.body,
      state: input.state ?? "draft",
      id: newFileId(),
      updatedAt: Date.now(),
    };
    patch(projectId, (s) => ({ ...s, files: [...s.files, file] }));
    return file;
  },
  updateFile(projectId: string, id: string, input: Partial<Pick<MdFile, "path" | "title" | "body" | "state">>) {
    patch(projectId, (s) => ({
      ...s,
      files: s.files.map((f) =>
        f.id === id ? { ...f, ...input, path: input.path ? normalizeMdPath(input.path) : f.path, updatedAt: Date.now() } : f,
      ),
    }));
  },
  setFileState(projectId: string, id: string, state: MdFileState) {
    patch(projectId, (s) => ({
      ...s,
      files: s.files.map((f) => (f.id === id ? { ...f, state, updatedAt: Date.now() } : f)),
    }));
  },
  removeFile(projectId: string, id: string) {
    patch(projectId, (s) => ({ ...s, files: s.files.filter((f) => f.id !== id) }));
  },
};
