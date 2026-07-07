import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  Boxes,
  Columns2,
  Database,
  FileText,
  FolderKanban,
  GitCompare,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Monitor,
  MonitorPlay,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Smartphone,
  Square,
  SquareStack,
  Tablet,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useCMS, useProjectTree, pageActions, sectionActions } from "@/lib/cms/store";
import { findNode } from "@/lib/cms/tree";
import { editorBus } from "@/lib/cms/editor-bus";
import { formatShortcut, shortcutByKeys } from "@/lib/cms/shortcuts";
import { listRecent } from "@/lib/cms/recent-nodes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Scope = "pages" | "collections" | "components";

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { workspace, project } = useParams({ strict: false }) as { workspace?: string; project?: string };
  const { node: nodeId, scope } = useSearch({ strict: false }) as { node?: string; scope?: Scope };

  const workspaces = useCMS((s) => s.workspaces);
  const projects = useCMS((s) =>
    workspace ? s.projects.filter((p) => p.workspaceId === s.workspaces.find((w) => w.slug === workspace)?.id) : [],
  );
  const tree = useProjectTree(workspace ?? "", project ?? "");
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

  const recent = useMemo(() => (workspace && project ? listRecent(workspace, project) : []), [workspace, project, open]);
  const allNodes = useMemo(() => flattenTree(tree), [tree]);

  const go = (fn: () => void) => {
    onOpenChange(false);
    setTimeout(fn, 0);
  };

  const navTo = (target: { scope: Scope; nodeId?: string }) => {
    if (!workspace || !project) return;
    navigate({
      to: "/w/$workspace/p/$project/editor",
      params: { workspace, project },
      search: { scope: target.scope, node: target.nodeId },
      replace: false,
    });
  };

  const inEditor = Boolean(workspace && project);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {inEditor && (
          <CommandGroup heading="Actions">
            <Item
              icon={Send}
              label="Publish current page"
              shortcutKeys="mod+shift+enter"
              disabled={!currentPageId}
              onSelect={() => go(() => currentPageId && pageActions.publish(currentPageId))}
            />
            <Item
              icon={SquareStack}
              label="Duplicate selected section"
              shortcutKeys="mod+d"
              disabled={!section}
              onSelect={() => go(() => section && sectionActions.duplicate(section.id))}
            />
            <Item
              icon={Trash2}
              label="Delete selected section"
              shortcutKeys="backspace"
              disabled={!section}
              onSelect={() =>
                go(() => {
                  if (!section) return;
                  if (window.confirm(`Delete section "${section.name}"?`)) sectionActions.remove(section.id);
                })
              }
            />
            <Item
              icon={Pencil}
              label="Rename selected"
              disabled={!node}
              onSelect={() => go(() => editorBus.emit({ type: "editor:rename-selected" }))}
            />
          </CommandGroup>
        )}

        {inEditor && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Create">
              <Item
                icon={Plus}
                label="New page"
                shortcutKeys="mod+n"
                onSelect={() => go(() => {
                  navTo({ scope: "pages" });
                  window.dispatchEvent(new CustomEvent("bcms:create", { detail: { scope: "pages" } }));
                })}
              />
              <Item
                icon={Plus}
                label="New collection"
                onSelect={() => go(() => {
                  navTo({ scope: "collections" });
                  window.dispatchEvent(new CustomEvent("bcms:create", { detail: { scope: "collections" } }));
                })}
              />
              <Item
                icon={Plus}
                label="New component"
                onSelect={() => go(() => {
                  navTo({ scope: "components" });
                  window.dispatchEvent(new CustomEvent("bcms:create", { detail: { scope: "components" } }));
                })}
              />
              {currentCollectionId && (
                <Item
                  icon={Plus}
                  label="New entry in current collection"
                  onSelect={() => go(() => window.dispatchEvent(new CustomEvent("bcms:create", { detail: { scope: "collections", collectionId: currentCollectionId } })))}
                />
              )}
              <Item
                icon={ImageIcon}
                label="Upload media"
                onSelect={() => go(() =>
                  workspace && project &&
                  navigate({ to: "/w/$workspace/p/$project/media", params: { workspace, project } }),
                )}
              />
            </CommandGroup>
          </>
        )}

        {inEditor && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Editor">
              <Item icon={FileText} label="Content mode" shortcutKeys="mod+1"
                onSelect={() => go(() => editorBus.emit({ type: "editor:set-mode", mode: "content" }))} />
              <Item icon={Columns2} label="Split mode" shortcutKeys="mod+2"
                onSelect={() => go(() => editorBus.emit({ type: "editor:set-mode", mode: "split" }))} />
              <Item icon={MonitorPlay} label="Preview mode" shortcutKeys="mod+3"
                onSelect={() => go(() => editorBus.emit({ type: "editor:set-mode", mode: "preview" }))} />
              <Item icon={Square} label="Toggle left panel" shortcutKeys="["
                onSelect={() => go(() => editorBus.emit({ type: "editor:toggle-panel", side: "left" }))} />
              <Item icon={Square} label="Toggle right panel" shortcutKeys="]"
                onSelect={() => go(() => editorBus.emit({ type: "editor:toggle-panel", side: "right" }))} />
              <Item icon={LayoutTemplate} label="Focus content tree" shortcutKeys="mod+\\"
                onSelect={() => go(() => editorBus.emit({ type: "editor:focus-tree" }))} />
            </CommandGroup>

            <CommandSeparator />
            <CommandGroup heading="Preview">
              <Item icon={Pencil} label="Source: Draft" shortcutKeys="mod+shift+d"
                onSelect={() => go(() => editorBus.emit({ type: "editor:set-preview-source", source: "draft" }))} />
              <Item icon={Globe} label="Source: Published" shortcutKeys="mod+shift+l"
                onSelect={() => go(() => editorBus.emit({ type: "editor:set-preview-source", source: "published" }))} />
              <Item icon={Monitor} label="Device: Desktop"
                onSelect={() => go(() => editorBus.emit({ type: "editor:set-preview-device", device: "desktop" }))} />
              <Item icon={Tablet} label="Device: Tablet"
                onSelect={() => go(() => editorBus.emit({ type: "editor:set-preview-device", device: "tablet" }))} />
              <Item icon={Smartphone} label="Device: Mobile"
                onSelect={() => go(() => editorBus.emit({ type: "editor:set-preview-device", device: "mobile" }))} />
              <Item icon={RefreshCw} label="Refresh preview"
                onSelect={() => go(() => editorBus.emit({ type: "editor:refresh-preview" }))} />
            </CommandGroup>
          </>
        )}

        {inEditor && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Navigate">
              <Item icon={FileText} label="Pages" shortcutKeys="g p"
                onSelect={() => go(() => navTo({ scope: "pages" }))} />
              <Item icon={Database} label="Collections" shortcutKeys="g c"
                onSelect={() => go(() => navTo({ scope: "collections" }))} />
              <Item icon={Layers} label="Components" shortcutKeys="g m"
                onSelect={() => go(() => navTo({ scope: "components" }))} />
              <Item icon={ImageIcon} label="Media" shortcutKeys="g i"
                onSelect={() => go(() =>
                  workspace && project &&
                  navigate({ to: "/w/$workspace/p/$project/media", params: { workspace, project } }),
                )}
              />
              <Item icon={Settings2} label="Project settings"
                onSelect={() => go(() =>
                  workspace && project &&
                  navigate({ to: "/w/$workspace/p/$project/settings", params: { workspace, project } }),
                )}
              />
            </CommandGroup>
          </>
        )}

        {recent.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent">
              {recent.map((r) => (
                <Item
                  key={`${r.scope}:${r.nodeId}`}
                  icon={iconForScope(r.scope)}
                  label={r.label}
                  hint={SCOPE_LABEL[r.scope]}
                  onSelect={() => go(() => navTo({ scope: r.scope, nodeId: r.nodeId }))}
                />
              ))}
            </CommandGroup>
          </>
        )}

        {inEditor && allNodes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Jump to…">
              {allNodes.map((n) => (
                <Item
                  key={n.id}
                  icon={iconForKind(n.kind)}
                  label={n.label}
                  hint={n.path}
                  keywords={n.path}
                  onSelect={() => go(() => {
                    if (n.kind === "media") {
                      workspace && project &&
                      navigate({ to: "/w/$workspace/p/$project/media", params: { workspace, project } });
                    } else {
                      navTo({ scope: n.scope, nodeId: n.id });
                    }
                  })}
                />
              ))}
            </CommandGroup>
          </>
        )}

        {workspace && projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.map((p) => (
                <Item
                  key={p.id}
                  icon={Layers}
                  label={p.name}
                  onSelect={() => go(() =>
                    navigate({ to: "/w/$workspace/p/$project", params: { workspace: workspace!, project: p.slug } }),
                  )}
                />
              ))}
            </CommandGroup>
          </>
        )}

        {workspace && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workspace">
              <Item icon={FolderKanban} label="All projects"
                onSelect={() => go(() => navigate({ to: "/w/$workspace", params: { workspace: workspace! } }))} />
              <Item icon={Settings2} label="Workspace settings"
                onSelect={() => go(() => navigate({ to: "/w/$workspace/settings", params: { workspace: workspace! } }))} />
              <Item icon={Users} label="Members"
                onSelect={() => go(() => navigate({ to: "/w/$workspace/members", params: { workspace: workspace! } }))} />
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Switch workspace">
          {workspaces.map((w) => (
            <Item
              key={w.id}
              icon={Boxes}
              label={w.name}
              onSelect={() => go(() => navigate({ to: "/w/$workspace", params: { workspace: w.slug } }))}
            />
          ))}
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-3 py-1.5 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
          <span><Kbd>⏎</Kbd> run</span>
          <span><Kbd>esc</Kbd> close</span>
        </div>
        <button
          type="button"
          onClick={() => { onOpenChange(false); setTimeout(() => editorBus.emit({ type: "editor:open-cheatsheet" }), 0); }}
          className="rounded-[4px] px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
        >
          <Kbd>?</Kbd> shortcuts
        </button>
      </div>
    </CommandDialog>
  );
}

// ----- helpers -----

const SCOPE_LABEL: Record<Scope, string> = { pages: "Pages", collections: "Collections", components: "Components" };

function iconForScope(s: Scope): LucideIcon {
  return s === "pages" ? FileText : s === "collections" ? Database : Layers;
}

function iconForKind(k: string): LucideIcon {
  if (k === "page") return FileText;
  if (k === "section") return LayoutTemplate;
  if (k === "collection") return Database;
  if (k === "entry") return FileText;
  if (k === "component") return Layers;
  if (k === "media") return ImageIcon;
  return Square;
}

interface FlatNode {
  id: string;
  label: string;
  kind: string;
  scope: Scope;
  path: string;
}

function flattenTree(tree: ReturnType<typeof useProjectTree>): FlatNode[] {
  const out: FlatNode[] = [];
  const groups: { group: typeof tree[number] | undefined; scope: Scope }[] = [
    { group: tree[0], scope: "pages" },
    { group: tree[1], scope: "collections" },
    { group: tree[2], scope: "components" },
  ];
  for (const { group, scope } of groups) {
    if (!group?.children) continue;
    for (const top of group.children) {
      out.push({ id: top.id, label: top.label, kind: top.kind, scope, path: group.label });
      if (top.children) {
        for (const child of top.children) {
          out.push({ id: child.id, label: child.label, kind: child.kind, scope, path: `${group.label} · ${top.label}` });
        }
      }
    }
  }
  return out;
}

interface ItemProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  shortcutKeys?: string;
  keywords?: string;
  disabled?: boolean;
  onSelect: () => void;
}

function Item({ icon: Icon, label, hint, shortcutKeys, keywords, disabled, onSelect }: ItemProps) {
  const doc = shortcutKeys ? shortcutByKeys(shortcutKeys) : undefined;
  return (
    <CommandItem
      onSelect={() => !disabled && onSelect()}
      value={`${label} ${hint ?? ""} ${keywords ?? ""}`}
      className={disabled ? "opacity-40" : ""}
    >
      <Icon className="mr-2 h-3.5 w-3.5" />
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="ml-2 truncate text-[11px] text-muted-foreground">{hint}</span>}
      {shortcutKeys && (
        <span className="ml-3 flex items-center gap-0.5">
          {shortcutKeys.includes(" ")
            ? shortcutKeys.split(" ").map((k, i) => <Kbd key={i}>{k.toUpperCase()}</Kbd>)
            : formatShortcut(shortcutKeys).map((k, i) => <Kbd key={i}>{k}</Kbd>)}
        </span>
      )}
      {doc?.label && false /* doc title — not rendered to keep row compact */}
    </CommandItem>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-[3px] border border-border bg-background px-1 font-mono text-[9px] text-muted-foreground">
      {children}
    </kbd>
  );
}

/** Hook to open the palette on ⌘K / Ctrl+K from anywhere. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return useMemo(() => ({ open, setOpen }), [open]);
}
