import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  Boxes,
  ChevronRight,
  Component,
  Database,
  FileText,
  FileType2,
  LayoutTemplate,
  Plus,
  Search,
  Settings as SettingsIcon,
} from "lucide-react";
import { useCMSVersion } from "@/lib/cms/store";
import {
  getCollection,
  getComponent,
  getEntriesForCollection,
  getPage,
  getProjectBySlug,
  getSectionsForPage,
  getWebsiteForProject,
} from "@/lib/cms/use-cms";
import { BLOCK_REGISTRY } from "@/lib/cms/blocks/registry";
import { pathKey } from "@/lib/cms/blocks/operations";
import type { Block, TreeNode, TreeNodeKind } from "@/lib/cms/types";
import { CreateEntityModal, type CreateKind } from "./modals/CreateEntityModal";
import { editorBus } from "@/lib/cms/editor-bus";

type Scope = "pages" | "collections" | "components";

interface Props {
  selectedId?: string;
  onSelect?: (id: string) => void;
  scope?: Scope;
}

const SCOPE_LABEL: Record<Scope, string> = {
  pages: "Pages",
  collections: "Collections",
  components: "Components",
};

const KIND_ICON: Record<TreeNodeKind, typeof FileText> = {
  group: FileText,
  page: FileText,
  section: LayoutTemplate,
  block: Boxes,
  collection: Database,
  entry: FileType2,
  component: Component,
  media: FileText,
  settings: SettingsIcon,
};

function blocksToTreeNodes(
  sectionId: string,
  blocks: Block[] | undefined,
  parentPath: number[] = [],
): TreeNode[] {
  if (!blocks || blocks.length === 0) return [];
  return blocks.map((b, i) => {
    const path = [...parentPath, i];
    const def = BLOCK_REGISTRY[b.kind];
    const previewText =
      (typeof b.props.text === "string" && b.props.text) ||
      (typeof b.props.title === "string" && b.props.title) ||
      (typeof b.props.label === "string" && b.props.label) ||
      "";
    const label = previewText
      ? `${def?.label ?? b.kind} · ${previewText}`
      : def?.label ?? b.kind;
    const kids = blocksToTreeNodes(sectionId, b.children, path);
    return {
      id: `block:${sectionId}:${pathKey(path)}`,
      label,
      kind: "block" as const,
      refId: b.id,
      children: kids.length ? kids : undefined,
    };
  });
}

export function ContentTree({ selectedId, onSelect, scope }: Props) {
  const { workspace, project } = useParams({ strict: false }) as {
    workspace: string;
    project: string;
  };
  const v = useCMSVersion();
  const pr = getProjectBySlug(workspace, project);
  const activeScope: Scope = scope ?? "pages";
  const [modalIntent, setModalIntent] = useState<CreateKind | null>(null);
  const [query, setQuery] = useState("");

  const nodes: TreeNode[] = useMemo(() => {
    if (!pr) return [];
    if (activeScope === "pages") {
      const website = getWebsiteForProject(pr.id);
      return (website?.pageIds ?? []).flatMap((pid) => {
        const page = getPage(pid);
        if (!page) return [];
        const stateBadge = page.publishState && page.publishState !== "published" ? ` · ${page.publishState}` : "";
        const allSections = getSectionsForPage(page.id);
        const toSectionNode = (s: typeof allSections[number]): TreeNode => {
          const blockKids = s.componentId ? [] : blocksToTreeNodes(s.id, s.blocks);
          const label = s.componentId ? `${s.name} · bound` : s.name;
          return {
            id: `section:${s.id}`,
            label,
            kind: "section" as const,
            refId: s.id,
            children: blockKids.length ? blockKids : undefined,
          };
        };
        // Group sections by region when the page has enough sections to benefit
        const useGroups = allSections.length >= 3;
        let pageChildren: TreeNode[];
        if (useGroups) {
          const buckets: Record<"Header" | "Main" | "Footer", TreeNode[]> = { Header: [], Main: [], Footer: [] };
          for (const s of allSections) {
            const region = s.kind === "navigation" || s.kind === "header" ? "Header"
              : s.kind === "footer" ? "Footer" : "Main";
            buckets[region].push(toSectionNode(s));
          }
          pageChildren = (["Header", "Main", "Footer"] as const)
            .filter((r) => buckets[r].length > 0)
            .map((r) => ({
              id: `group:${page.id}:${r}`,
              label: r,
              kind: "group" as const,
              refId: page.id,
              children: buckets[r],
            }));
        } else {
          pageChildren = allSections.map(toSectionNode);
        }
        return [
          {
            id: `page:${page.id}`,
            label: `${page.title}${stateBadge}`,
            kind: "page" as const,
            refId: page.id,
            children: pageChildren,
          },
        ];
      });
    }
    if (activeScope === "collections") {
      return pr.collectionIds.flatMap((cid) => {
        const col = getCollection(cid);
        if (!col) return [];
        return [
          {
            id: `collection:${col.id}`,
            label: `${col.name} · ${col.entryIds.length}`,
            kind: "collection" as const,
            refId: col.id,
            children: getEntriesForCollection(col.id).map((e) => {
              const status = e.status && e.status !== "published" ? ` · ${e.status}` : "";
              return {
                id: `entry:${e.id}`,
                label: `${e.title}${status}`,
                kind: "entry" as const,
                refId: e.id,
              };
            }),
          },
        ];
      });
    }
    return pr.componentIds.flatMap((cid) => {
      const c = getComponent(cid);
      if (!c) return [];
      const count = c.variantIds.length;
      return [
        {
          id: `component:${c.id}`,
          label: count > 0 ? `${c.name} · ${count}` : c.name,
          kind: "component" as const,
          refId: c.id,
        },
      ];
    });
  }, [pr?.id, activeScope, v]);


  const filtered = useMemo<TreeNode[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    const out: TreeNode[] = [];
    for (const n of nodes) {
      const labelMatch = n.label.toLowerCase().includes(q);
      const kids = n.children?.filter((c) => c.label.toLowerCase().includes(q)) ?? [];
      if (labelMatch) out.push({ ...n, children: n.children });
      else if (kids.length) out.push({ ...n, children: kids });
    }
    return out;
  }, [nodes, query]);

  const onAddClick = () => {
    if (!workspace || !project) return;
    if (activeScope === "pages") setModalIntent({ type: "page", workspace, project });
    else if (activeScope === "collections")
      setModalIntent({ type: "collection", workspace, project });
    else setModalIntent({ type: "component", workspace, project });
  };

  const totalCount = nodes.length;

  return (
    <div className="flex h-full flex-col text-[13px]">
      <div className="shrink-0 px-3 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <div className="text-[13px] font-semibold tracking-tight text-foreground">
              {SCOPE_LABEL[activeScope]}
            </div>
          </div>
          <button
            aria-label={`Add ${activeScope.slice(0, -1)}`}
            onClick={onAddClick}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5 rounded-md border border-border bg-background px-2">
          <Search className="h-3 w-3 text-muted-foreground" />
          <input
            id="bcms-tree-filter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${SCOPE_LABEL[activeScope].toLowerCase()}…`}
            className="h-7 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-2">
        {totalCount === 0 ? (
          <button
            onClick={onAddClick}
            className="mx-3 mt-2 flex w-[calc(100%-1.5rem)] items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-4 text-[12px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Create {activeScope.slice(0, -1)}
          </button>
        ) : filtered.length === 0 ? (
          <div className="px-3 pt-3 text-[12px] text-muted-foreground">No matches.</div>
        ) : (
          filtered.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
              defaultOpen
            />
          ))
        )}
      </div>
      <CreateEntityModal
        open={!!modalIntent}
        onOpenChange={(v) => !v && setModalIntent(null)}
        intent={modalIntent}
      />
    </div>
  );
}

interface RowProps {
  node: TreeNode;
  depth: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  defaultOpen?: boolean;
}

function TreeRow({ node, depth, selectedId, onSelect, defaultOpen }: RowProps) {
  const [open, setOpen] = useState(defaultOpen ?? depth < 1);
  const hasChildren = !!node.children?.length;
  const selected = selectedId === node.id;
  const Icon = KIND_ICON[node.kind] ?? FileText;

  // Linear-style click behaviour:
  //  - unselected row with children → select + expand in one go
  //  - already-selected row with children → toggle expansion
  //  - leaf → just select
  // Fire on mousedown to feel instant.
  const handleActivate = (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasChildren) {
      if (selected) setOpen((o) => !o);
      else setOpen(true);
    }
    onSelect?.(node.id);
  };

  const sectionId = node.kind === "section" ? node.refId : undefined;

  return (
    <div>
      <button
        type="button"
        onMouseDown={handleActivate}
        onClick={(e) => e.preventDefault()}
        onMouseEnter={() => {
          if (sectionId) editorBus.emit({ type: "editor:hover-section", sectionId });
        }}
        onMouseLeave={() => {
          if (sectionId) editorBus.emit({ type: "editor:hover-section", sectionId: undefined });
        }}
        aria-selected={selected}
        data-selected={selected || undefined}
        className={`group relative flex h-7 w-full items-center gap-1.5 pr-2 text-left transition-colors ${
          selected ? "bg-[color:var(--color-row-selected)]" : "hover:bg-[color:var(--color-row-hover)]"
        }`}
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        {/* Selection treatment is now a calm row-fill (above); no accent rail. */}
        {hasChildren ? (
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
            strokeWidth={1.75}
          />
        ) : (
          <span className="inline-block h-4 w-4 shrink-0" />
        )}
        <Icon
          className={`h-4 w-4 shrink-0 ${selected ? "text-foreground" : "text-muted-foreground"}`}
          strokeWidth={1.75}
        />
        <span
          className={`flex-1 truncate text-[13px] ${selected ? "font-medium text-foreground" : "text-foreground"}`}
        >
          {node.label}
        </span>
      </button>
      {open && hasChildren && (
        <div>
          {node.children!.map((c) => (
            <TreeRow key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Hook bound to the editor route's `node` search param. */
export function useTreeSelection() {
  const navigate = useNavigate();
  const { node } = useSearch({ strict: false }) as { node?: string };
  const setNode = (id: string) =>
    navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, node: id }), replace: true });
  return { node, setNode };
}
