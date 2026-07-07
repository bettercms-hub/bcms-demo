import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { findNode } from "@/lib/cms/tree";
import { useCMS, useProjectTree, pageActions, sectionActions } from "@/lib/cms/store";
import { editorBus } from "@/lib/cms/editor-bus";
import { useShortcuts } from "@/lib/cms/shortcuts";

type Scope = "pages" | "collections" | "components";

/** Mounts editor-scoped keyboard shortcuts. Reads selection from URL + store. */
export function EditorShortcuts() {
  const { workspace, project } = useParams({ strict: false }) as { workspace: string; project: string };
  const navigate = useNavigate();
  const { node: nodeId, scope } = useSearch({ strict: false }) as { node?: string; scope?: Scope };
  const tree = useProjectTree(workspace, project);
  const node = nodeId ? findNode(tree, nodeId) : undefined;

  const section = useCMS((s) => (node?.kind === "section" && node.refId ? s.sections.find((x) => x.id === node.refId) : undefined));
  const entryCollectionId = useCMS((s) =>
    node?.kind === "entry" && node.refId ? s.entries.find((e) => e.id === node.refId)?.collectionId : undefined,
  );
  const currentPageId =
    node?.kind === "page" ? node.refId :
    node?.kind === "section" ? section?.pageId :
    undefined;
  const currentCollectionId = node?.kind === "collection" ? node.refId : entryCollectionId;

  const goScope = (next: Scope) =>
    navigate({
      to: "/w/$workspace/p/$project/editor",
      params: { workspace, project },
      search: { scope: next, node: undefined },
      replace: true,
    });

  useShortcuts(
    [
      // Mode
      { keys: "mod+1", run: () => editorBus.emit({ type: "editor:set-mode", mode: "content" }) },
      { keys: "mod+2", run: () => editorBus.emit({ type: "editor:set-mode", mode: "split" }) },
      { keys: "mod+3", run: () => editorBus.emit({ type: "editor:set-mode", mode: "preview" }) },

      // Panels
      { keys: "[", run: () => editorBus.emit({ type: "editor:toggle-panel", side: "left" }) },
      { keys: "]", run: () => editorBus.emit({ type: "editor:toggle-panel", side: "right" }) },
      { keys: "mod+\\", run: () => editorBus.emit({ type: "editor:focus-tree" }) },

      // Preview source
      { keys: "mod+shift+d", run: () => editorBus.emit({ type: "editor:set-preview-source", source: "draft" }) },
      { keys: "mod+shift+l", run: () => editorBus.emit({ type: "editor:set-preview-source", source: "published" }) },

      // Publish
      {
        keys: "mod+shift+enter",
        when: () => Boolean(currentPageId),
        run: () => currentPageId && pageActions.publish(currentPageId),
      },

      // Section ops
      {
        keys: "mod+d",
        when: () => Boolean(section),
        run: () => section && sectionActions.duplicate(section.id),
      },
      {
        keys: "backspace",
        when: () => Boolean(section),
        run: () => {
          if (!section) return;
          if (window.confirm(`Delete section "${section.name}"?`)) sectionActions.remove(section.id);
        },
      },
      {
        keys: "delete",
        when: () => Boolean(section),
        run: () => {
          if (!section) return;
          if (window.confirm(`Delete section "${section.name}"?`)) sectionActions.remove(section.id);
        },
      },
      {
        keys: "alt+up",
        when: () => Boolean(section),
        run: () => section && sectionActions.move(section.id, -1),
      },
      {
        keys: "alt+down",
        when: () => Boolean(section),
        run: () => section && sectionActions.move(section.id, 1),
      },

      // Create (context aware)
      {
        keys: "mod+n",
        run: () => {
          const event = new CustomEvent("bcms:create", {
            detail: { scope: scope ?? "pages", collectionId: currentCollectionId },
          });
          window.dispatchEvent(event);
        },
      },
    ],
    [
      { keys: "g p", run: () => goScope("pages") },
      { keys: "g c", run: () => goScope("collections") },
      { keys: "g m", run: () => goScope("components") },
      {
        keys: "g i",
        run: () =>
          navigate({ to: "/w/$workspace/p/$project/media", params: { workspace, project } }),
      },
    ],
  );

  return null;
}
