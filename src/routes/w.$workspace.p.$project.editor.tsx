import { createFileRoute } from "@tanstack/react-router";
import { EditorShell } from "@/components/cms/editor/EditorShell";

type Scope = "pages" | "collections" | "components";

/**
 * All three params are genuinely optional: navigations routinely set only
 * `scope`/`node` (sidebar, palette, create modal) or nothing at all (the
 * project index redirect). Declaring them optional keeps those call sites
 * honest without changing runtime behavior.
 */
interface EditorSearch {
  node?: string;
  scope?: Scope;
  section?: string;
}

export const Route = createFileRoute("/w/$workspace/p/$project/editor")({
  validateSearch: (s: Record<string, unknown>): EditorSearch => ({
    node: (s.node as string) || undefined,
    scope: (["pages", "collections", "components"] as const).includes(s.scope as Scope)
      ? (s.scope as Scope)
      : undefined,
    section: (s.section as string) || undefined,
  }),
  component: EditorShell,
});
