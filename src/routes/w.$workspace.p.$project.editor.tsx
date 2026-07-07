import { createFileRoute } from "@tanstack/react-router";
import { EditorShell } from "@/components/cms/editor/EditorShell";

type Scope = "pages" | "collections" | "components";

export const Route = createFileRoute("/w/$workspace/p/$project/editor")({
  validateSearch: (s: Record<string, unknown>) => ({
    node: (s.node as string) || undefined,
    scope: ((["pages", "collections", "components"] as const).includes(s.scope as Scope)
      ? (s.scope as Scope)
      : undefined) as Scope | undefined,
    section: (s.section as string) || undefined,
  }),
  component: EditorShell,
});
