import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AppWindow,
  Layers,
  Archive,
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  Folder,
  FolderInput,
  FolderKanban,
  FolderPlus,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useCMS } from "@/lib/cms/store";
import { useFolders, type Folder as FolderType } from "@/lib/cms/use-folders";
import { StackIcon, StackTag, type StackKey } from "@/components/cms/icons/StackIcon";
import { NewProjectWizard } from "@/components/cms/project/NewProjectWizard";
import { SitePlanBadge } from "@/components/cms/billing/PlanBadge";
import type { ProjectKind, SitePlanId } from "@/lib/cms/types";
import { modeOf, type DeliveryMode } from "@/lib/cms/delivery";

export const Route = createFileRoute("/w/$workspace/")({
  component: WorkspaceHome,
});

/* ──────────────────────────  utils / types  ────────────────────────── */

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

type StatusKey = "live" | "draft" | "scheduled" | "archived";
type SortKey = "updated" | "name" | "status";

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  domain: string;
  updatedAt: string;
  status: StatusKey;
  plan: SitePlanId;
  stack: StackKey;
  kind: ProjectKind;
  mode: DeliveryMode;
};

// A row in the explorer is either a folder or a project — they live side by side.
type ExplorerItem =
  | { kind: "folder"; folder: FolderType; count: number; lastUpdated?: string; previewSeeds: string[] }
  | { kind: "project"; project: ProjectRow };

/* ──────────────────────────  page  ────────────────────────── */

function WorkspaceHome() {
  const { workspace } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === workspace))!;

  const projects = useCMS((s) => s.projects);
  const domains = useCMS((s) => s.domains);

  const rows = useMemo(() => {
    const wsProjects = projects
      .filter((p) => p.workspaceId === ws.id)
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

    return wsProjects.map((p, i): ProjectRow => {
      const isLive = (p.publishState ?? "published") === "published";
      const status: StatusKey = isLive ? "live" : (["draft", "scheduled", "draft"] as StatusKey[])[i % 3];
      const dom =
        domains.find((d) => d.projectId === p.id && d.primary) ?? domains.find((d) => d.projectId === p.id);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        domain: dom?.host ?? `${p.slug}.bettercms.site`,
        updatedAt: p.updatedAt,
        status,
        plan: p.sitePlan ?? "free",
        stack:
          p.framework === "astro"
            ? "astro"
            : p.framework === "nextjs"
              ? "nextjs"
              : seedNum(`${p.id}:stack`) % 2 === 0
                ? "nextjs"
                : "astro",
        kind: p.kind ?? "managed",
        mode: modeOf(p),
      };
    });
  }, [projects, domains, ws.id]);

  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-8 pb-24 pt-12">
      <WorkspaceHeader name={ws.name} onNewProject={() => setWizardOpen(true)} />
      <ProjectsExplorer workspace={workspace} projects={rows} onNewProject={() => setWizardOpen(true)} />
      <NewProjectWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        workspaceId={ws.id}
        workspaceSlug={workspace}
      />
    </div>
  );
}

/* ──────────────────────────  header  ────────────────────────── */

function WorkspaceHeader({ name, onNewProject }: { name: string; onNewProject: () => void }) {
  return (
    <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Workspace
        </div>
        <h1 className="mt-1.5 text-[26px] font-semibold leading-[1.1] tracking-tight text-foreground">
          {name}
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          All your projects, organized.
        </p>
      </div>
      <button
        type="button"
        onClick={onNewProject}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_2px_8px_-2px_rgba(239,3,127,0.4)] transition-all duration-150 hover:bg-[var(--primary-hover)] hover:shadow-[0_5px_14px_-3px_rgba(239,3,127,0.55)] active:scale-[0.98]"
      >
        <Plus className="h-3.5 w-3.5" /> New project
      </button>
    </section>
  );
}

/* ──────────────────────────  projects explorer  ────────────────────────── */

function ProjectsExplorer({
  workspace,
  projects,
  onNewProject,
}: {
  workspace: string;
  projects: ProjectRow[];
  onNewProject: () => void;
}) {
  const { folders, assignments, createFolder, renameFolder, deleteFolder, moveToFolder } =
    useFolders(workspace);

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [view, setView] = useState<"list" | "grid">("list");

  const [dialog, setDialog] = useState<{ open: boolean; mode: "create" | "rename"; id?: string; name: string }>({
    open: false,
    mode: "create",
    name: "",
  });

  // If the open folder is deleted, pop back to the root.
  useEffect(() => {
    if (activeFolder && !folders.some((f) => f.id === activeFolder)) setActiveFolder(null);
  }, [folders, activeFolder]);

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 220);
    return () => clearTimeout(t);
  }, []);

  const openFolder = (id: string | null) => {
    setActiveFolder(id);
  };

  const sortProjects = (list: ProjectRow[]) =>
    [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "status") return a.status.localeCompare(b.status);
      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    });

  const activeFolderObj = folders.find((f) => f.id === activeFolder) ?? null;
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  // Build the list of items to show (folders + projects as siblings).
  const items: ExplorerItem[] = useMemo(() => {
    if (searching) {
      // Search flattens across every project, ignoring folders (Webflow-style).
      const matches = projects.filter(
        (p) => p.name.toLowerCase().includes(q) || p.domain.toLowerCase().includes(q),
      );
      return sortProjects(matches).map((project) => ({ kind: "project", project }));
    }
    if (activeFolder) {
      const inFolder = projects.filter((p) => assignments[p.id] === activeFolder);
      return sortProjects(inFolder).map((project) => ({ kind: "project", project }));
    }
    // Root: folders first, then loose (unfiled) projects.
    const folderItems: ExplorerItem[] = folders
      .map((folder) => {
        const contained = projects.filter((p) => assignments[p.id] === folder.id);
        const lastUpdated = contained.length
          ? contained.reduce((a, p) => (p.updatedAt > a ? p.updatedAt : a), contained[0].updatedAt)
          : undefined;
        return {
          kind: "folder" as const,
          folder,
          count: contained.length,
          lastUpdated,
          previewSeeds: contained.slice(0, 4).map((p) => p.id),
        };
      })
      .sort((a, b) => {
        if (a.kind !== "folder" || b.kind !== "folder") return 0;
        if (sort === "name") return a.folder.name.localeCompare(b.folder.name);
        return (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? "");
      });
    const unfiled = projects.filter((p) => !assignments[p.id]);
    return [...folderItems, ...sortProjects(unfiled).map((project) => ({ kind: "project" as const, project }))];
  }, [searching, q, activeFolder, projects, assignments, folders, sort]);

  const sortLabel = sort === "name" ? "Name" : sort === "status" ? "Status" : "Last updated";

  /* folder actions */
  function submitDialog(name: string) {
    if (dialog.mode === "create") {
      const id = createFolder(name);
      if (id) toast.success(`Folder “${name}” created`);
    } else if (dialog.id) {
      renameFolder(dialog.id, name);
      toast.success("Folder renamed");
    }
  }
  function handleDeleteFolder(f: FolderType) {
    const n = projects.filter((p) => assignments[p.id] === f.id).length;
    deleteFolder(f.id);
    if (activeFolder === f.id) setActiveFolder(null);
    toast.success(`Folder “${f.name}” deleted${n ? ` · ${n} project${n === 1 ? "" : "s"} moved out` : ""}`);
  }
  if (!loading && projects.length === 0) {
    return <EmptyProjects onNewProject={onNewProject} />;
  }

  return (
    <div className="space-y-4">
      {/* breadcrumb — only when inside a folder */}
      {activeFolderObj && !searching && (
        <div className="flex items-center gap-1.5 text-[13px]">
          <button
            type="button"
            onClick={() => openFolder(null)}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All projects
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="inline-flex items-center gap-1.5 px-1 font-medium text-foreground">
            <Folder className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.9} />
            {activeFolderObj.name}
          </span>
          <FolderMenu
            onRename={() => setDialog({ open: true, mode: "rename", id: activeFolderObj.id, name: activeFolderObj.name })}
            onDelete={() => handleDeleteFolder(activeFolderObj)}
          />
        </div>
      )}

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--input-bg)] px-3 transition-colors duration-[120ms] focus-within:border-[color:var(--color-border-strong)]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all projects…"
            className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ToolbarSelect
          icon={ArrowUpDown}
          label={sortLabel}
          items={[
            { label: "Last updated", onSelect: () => setSort("updated") },
            { label: "Name", onSelect: () => setSort("name") },
            { label: "Status", onSelect: () => setSort("status") },
          ]}
        />
        <button
          type="button"
          onClick={() => setDialog({ open: true, mode: "create", name: "" })}
          aria-label="New folder"
          title="New folder"
          className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:border-[color:var(--color-border-strong)] hover:text-foreground"
        >
          <FolderPlus className="h-4 w-4" />
        </button>
        <div className="flex h-9 items-center gap-0.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] p-1">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="List view"
            className={`grid h-7 w-8 place-items-center rounded-md transition-all duration-150 ${
              view === "list"
                ? "bg-[color:var(--elevated)] text-foreground shadow-[var(--shadow-1)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-4 w-4" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Grid view"
            className={`grid h-7 w-8 place-items-center rounded-md transition-all duration-150 ${
              view === "grid"
                ? "bg-[color:var(--elevated)] text-foreground shadow-[var(--shadow-1)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      {/* content */}
      {loading ? (
        view === "grid" ? <ProjectsGridSkeleton /> : <ProjectsTableSkeleton rows={5} />
      ) : items.length === 0 ? (
        <ExplorerEmpty searching={searching} inFolder={Boolean(activeFolder)} onClear={() => setQuery("")} />
      ) : view === "grid" ? (
        <ExplorerGrid
          workspace={workspace}
          items={items}
          onOpenFolder={openFolder}
          folders={folders}
          assignments={assignments}
          onMove={moveToFolder}
          onRenameFolder={(f) => setDialog({ open: true, mode: "rename", id: f.id, name: f.name })}
          onDeleteFolder={handleDeleteFolder}
        />
      ) : (
        <ExplorerTable
          workspace={workspace}
          items={items}
          onOpenFolder={openFolder}
          folders={folders}
          assignments={assignments}
          onMove={moveToFolder}
          onRenameFolder={(f) => setDialog({ open: true, mode: "rename", id: f.id, name: f.name })}
          onDeleteFolder={handleDeleteFolder}
        />
      )}

      <FolderDialog
        open={dialog.open}
        mode={dialog.mode}
        initialName={dialog.name}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSubmit={submitDialog}
      />
    </div>
  );
}

/* ──────────────────────────  status / env badges  ────────────────────────── */

const STATUS_META: Record<StatusKey, { label: string; dot: string }> = {
  live: { label: "Live", dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]" },
  draft: { label: "Draft", dot: "bg-amber-400" },
  scheduled: { label: "Scheduled", dot: "bg-sky-400" },
  archived: { label: "Archived", dot: "bg-rose-400" },
};

function StatusBadge({ status }: { status: StatusKey }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// Small framework mark chip — dark on light, white on dark (currentColor).
function StackChip({ stack }: { stack: StackKey }) {
  return (
    <StackTag stack={stack}>
      <span className="grid h-6 w-6 shrink-0 cursor-default place-items-center rounded-md bg-[color:var(--card)] text-foreground shadow-[var(--shadow-1)] ring-1 ring-[color:var(--border-hairline)]">
        <StackIcon stack={stack} className={stack === "astro" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </span>
    </StackTag>
  );
}

function TypeCell({ kind, mode }: { kind: "folder" | "project"; mode?: DeliveryMode }) {
  const Icon = kind === "folder" ? Folder : mode === "headless" ? Code2 : mode === "hybrid" ? Layers : AppWindow;
  const label = kind === "folder" ? "Folder" : mode === "headless" ? "Headless" : mode === "hybrid" ? "Hybrid" : "Site";
  const title =
    kind === "folder"
      ? undefined
      : mode === "headless"
        ? "Headless: your frontend renders content from the API"
        : mode === "hybrid"
          ? "Hybrid: hosted site plus the Content Delivery API"
          : "Hosted site: BetterCMS renders and hosts it";
  return (
    <span title={title} className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
      {label}
    </span>
  );
}

/* ──────────────────────────  site preview thumbnails  ────────────────────────── */

// Deterministic, no-image "website preview" — an SVG mockup seeded off the project
// id so every project gets a distinct-looking but stable thumbnail. Swap this for
// real site screenshots (or an iframe) once projects have live URLs.
const PREVIEW_PALETTES: [string, string][] = [
  ["#6366f1", "#a855f7"],
  ["#ec4899", "#f43f5e"],
  ["#0ea5e9", "#22d3ee"],
  ["#10b981", "#14b8a6"],
  ["#f59e0b", "#ef4444"],
  ["#8b5cf6", "#6366f1"],
  ["#14b8a6", "#0ea5e9"],
  ["#f43f5e", "#f59e0b"],
];

function seedNum(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function SitePreview({ seed }: { seed: string }) {
  const n = seedNum(seed);
  const [c1, c2] = PREVIEW_PALETTES[n % PREVIEW_PALETTES.length];
  const variant = n % 3;
  const gid = `sp${n % 1000000}`;
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="160" height="100" fill="#ffffff" />
      {/* nav */}
      <circle cx="12" cy="11" r="3" fill={`url(#${gid})`} />
      <rect x="121" y="9.5" width="9" height="3" rx="1.5" fill="#e2e8f0" />
      <rect x="133" y="9.5" width="9" height="3" rx="1.5" fill="#e2e8f0" />
      <rect x="145" y="9.5" width="9" height="3" rx="1.5" fill="#e2e8f0" />
      {variant === 0 && (
        <>
          <rect x="12" y="27" width="58" height="5" rx="2" fill="#0f172a" opacity="0.85" />
          <rect x="12" y="36" width="44" height="3" rx="1.5" fill="#cbd5e1" />
          <rect x="12" y="42" width="50" height="3" rx="1.5" fill="#cbd5e1" />
          <rect x="12" y="50" width="22" height="7" rx="3.5" fill={`url(#${gid})`} />
          <rect x="86" y="24" width="62" height="34" rx="3" fill={`url(#${gid})`} opacity="0.92" />
          <rect x="12" y="70" width="42" height="20" rx="2.5" fill="#f1f5f9" />
          <rect x="59" y="70" width="42" height="20" rx="2.5" fill="#f1f5f9" />
          <rect x="106" y="70" width="42" height="20" rx="2.5" fill="#f1f5f9" />
        </>
      )}
      {variant === 1 && (
        <>
          <rect x="0" y="18" width="160" height="40" fill={`url(#${gid})`} />
          <rect x="50" y="30" width="60" height="5" rx="2" fill="#ffffff" opacity="0.95" />
          <rect x="58" y="39" width="44" height="3" rx="1.5" fill="#ffffff" opacity="0.7" />
          <rect x="66" y="46" width="28" height="6" rx="3" fill="#ffffff" opacity="0.9" />
          <rect x="12" y="68" width="30" height="3.5" rx="1.75" fill="#334155" />
          <rect x="12" y="76" width="136" height="3" rx="1.5" fill="#e2e8f0" />
          <rect x="12" y="82" width="120" height="3" rx="1.5" fill="#e2e8f0" />
        </>
      )}
      {variant === 2 && (
        <>
          <rect x="0" y="16" width="40" height="84" fill="#f8fafc" />
          <rect x="8" y="24" width="24" height="3" rx="1.5" fill={`url(#${gid})`} />
          <rect x="8" y="32" width="20" height="3" rx="1.5" fill="#cbd5e1" />
          <rect x="8" y="39" width="22" height="3" rx="1.5" fill="#cbd5e1" />
          <rect x="8" y="46" width="18" height="3" rx="1.5" fill="#cbd5e1" />
          <rect x="48" y="24" width="58" height="5" rx="2" fill="#0f172a" opacity="0.85" />
          <rect x="48" y="34" width="100" height="26" rx="3" fill={`url(#${gid})`} opacity="0.92" />
          <rect x="48" y="66" width="46" height="24" rx="2.5" fill="#f1f5f9" />
          <rect x="100" y="66" width="48" height="24" rx="2.5" fill="#f1f5f9" />
        </>
      )}
    </svg>
  );
}

// Folder cover: a 2×2 collage of the previews of the projects inside (Webflow-style).
function FolderCollage({ seeds }: { seeds: string[] }) {
  if (seeds.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[color:var(--s2)]">
        <Folder className="h-9 w-9 text-muted-foreground/40" strokeWidth={1.5} />
      </div>
    );
  }
  if (seeds.length === 1) {
    return (
      <div className="h-full w-full">
        <SitePreview seed={seeds[0]} />
      </div>
    );
  }
  const cells = seeds.slice(0, 4);
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[3px] bg-[color:var(--s3)] p-[3px]">
      {cells.map((s) => (
        <div key={s} className="overflow-hidden rounded-[3px] bg-white">
          <SitePreview seed={s} />
        </div>
      ))}
      {Array.from({ length: 4 - cells.length }).map((_, i) => (
        <div key={`empty-${i}`} className="rounded-[3px] bg-[color:var(--s2)]" />
      ))}
    </div>
  );
}

/* ──────────────────────────  list view  ────────────────────────── */

const LIST_COLS = "grid-cols-[minmax(0,2fr)_100px_110px_130px_90px_56px]";

function ExplorerTable({
  workspace,
  items,
  onOpenFolder,
  folders,
  assignments,
  onMove,
  onRenameFolder,
  onDeleteFolder,
}: {
  workspace: string;
  items: ExplorerItem[];
  onOpenFolder: (id: string) => void;
  folders: FolderType[];
  assignments: Record<string, string>;
  onMove: (projectIds: string | string[], folderId: string | null) => void;
  onRenameFolder: (f: FolderType) => void;
  onDeleteFolder: (f: FolderType) => void;
}) {
  const navigate = useNavigate();
  return (
    <div>
      <div
        className={`grid ${LIST_COLS} gap-5 px-3 py-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground border-b border-[color:var(--border-hairline)] sticky top-0 z-[1] bg-[color:var(--canvas)]/85 backdrop-blur`}
      >
        <div>Name</div>
        <div>Type</div>
        <div>Status</div>
        <div>Last updated</div>
        <div>Plan</div>
        <div />
      </div>

      {items.map((it) =>
        it.kind === "folder" ? (
          <div
            key={it.folder.id}
            role="button"
            tabIndex={0}
            aria-label={`Open folder ${it.folder.name}`}
            onClick={() => onOpenFolder(it.folder.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenFolder(it.folder.id);
              }
            }}
            className={`group relative grid ${LIST_COLS} cursor-pointer items-center gap-5 border-b border-[color:var(--border-hairline)] px-3 py-4 text-[13px] transition-[background-color] duration-150 hover:bg-[color:var(--row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60`}
          >
            <div className="relative z-[1] flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[color:var(--s3)] text-muted-foreground">
                <Folder className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium text-foreground">{it.folder.name}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">
                  {it.count} project{it.count === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <div className="relative z-[1]"><TypeCell kind="folder" /></div>
            <div className="relative z-[1] text-[12.5px] text-muted-foreground">—</div>
            <div className="relative z-[1] text-[12.5px] tabular-nums text-muted-foreground">
              {it.lastUpdated ? relTime(it.lastUpdated) : "—"}
            </div>
            <div className="relative z-[1] text-[12.5px] text-muted-foreground">—</div>
            <div className="relative z-10 flex items-center justify-end">
              <FolderMenu onRename={() => onRenameFolder(it.folder)} onDelete={() => onDeleteFolder(it.folder)} />
            </div>
          </div>
        ) : (
          (() => {
            const p = it.project;
            return (
              <div
                key={p.id}
                role="link"
                tabIndex={0}
                aria-label={`Open ${p.name}`}
                onClick={() => navigate({ to: "/w/$workspace/p/$project", params: { workspace, project: p.slug } })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate({ to: "/w/$workspace/p/$project", params: { workspace, project: p.slug } });
                }}
                className={`group relative grid ${LIST_COLS} cursor-pointer items-center gap-5 border-b border-[color:var(--border-hairline)] px-3 py-4 text-[13px] transition-[background-color] duration-150 hover:bg-[color:var(--row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60`}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                />
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-9 w-14 shrink-0 overflow-hidden rounded border border-[color:var(--border-hairline)] bg-white">
                    <SitePreview seed={p.id} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-medium text-foreground">{p.name}</span>
                      <StackTag stack={p.stack}>
                        <span className="inline-flex shrink-0 cursor-default">
                          <StackIcon stack={p.stack} className="h-3.5 w-3.5 text-foreground/70" />
                        </span>
                      </StackTag>
                    </div>
                    <div className="truncate text-[11.5px] text-muted-foreground">{p.domain}</div>
                  </div>
                </div>
                <div><TypeCell kind="project" mode={p.mode} /></div>
                <div><StatusBadge status={p.status} /></div>
                <div className="text-[12.5px] tabular-nums text-muted-foreground">{relTime(p.updatedAt)}</div>
                <div><SitePlanBadge plan={p.plan} /></div>
                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                  <IconButton icon={ExternalLink} label="Open" />
                  <ProjectMenu
                    projectId={p.id}
                    folders={folders}
                    currentFolderId={assignments[p.id] ?? null}
                    onMove={onMove}
                  />
                </div>
              </div>
            );
          })()
        ),
      )}
    </div>
  );
}

/* ──────────────────────────  grid view  ────────────────────────── */

function ExplorerGrid({
  workspace,
  items,
  onOpenFolder,
  folders,
  assignments,
  onMove,
  onRenameFolder,
  onDeleteFolder,
}: {
  workspace: string;
  items: ExplorerItem[];
  onOpenFolder: (id: string) => void;
  folders: FolderType[];
  assignments: Record<string, string>;
  onMove: (projectIds: string | string[], folderId: string | null) => void;
  onRenameFolder: (f: FolderType) => void;
  onDeleteFolder: (f: FolderType) => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) =>
        it.kind === "folder" ? (
          <div
            key={it.folder.id}
            role="button"
            tabIndex={0}
            aria-label={`Open folder ${it.folder.name}`}
            onClick={() => onOpenFolder(it.folder.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenFolder(it.folder.id);
              }
            }}
            className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card transition-[transform,border-color] duration-[180ms] hover:-translate-y-px hover:border-[color:var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
          >
            <div className="aspect-[16/10] w-full border-b border-[color:var(--border-hairline)]">
              <FolderCollage seeds={it.previewSeeds} />
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[color:var(--s3)] text-muted-foreground">
                <Folder className="h-4 w-4" strokeWidth={1.9} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold tracking-tight text-foreground">{it.folder.name}</div>
                <div className="text-[12px] text-muted-foreground">
                  {it.count} project{it.count === 1 ? "" : "s"}
                </div>
              </div>
              <FolderMenu onRename={() => onRenameFolder(it.folder)} onDelete={() => onDeleteFolder(it.folder)} />
            </div>
          </div>
        ) : (
          (() => {
            const p = it.project;
            return (
              <div
                key={p.id}
                role="link"
                tabIndex={0}
                aria-label={`Open ${p.name}`}
                onClick={() => navigate({ to: "/w/$workspace/p/$project", params: { workspace, project: p.slug } })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate({ to: "/w/$workspace/p/$project", params: { workspace, project: p.slug } });
                }}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card transition-[transform,border-color] duration-[180ms] hover:-translate-y-px hover:border-[color:var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
              >
                <div className="relative aspect-[16/10] w-full border-b border-[color:var(--border-hairline)]">
                  <SitePreview seed={p.id} />
                  <div className="absolute left-2.5 top-2.5">
                    <StackChip stack={p.stack} />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold tracking-tight text-foreground">{p.name}</div>
                      <div className="truncate text-[12.5px] text-muted-foreground">{p.domain}</div>
                    </div>
                    <ProjectMenu
                      projectId={p.id}
                      folders={folders}
                      currentFolderId={assignments[p.id] ?? null}
                      onMove={onMove}
                    />
                  </div>
                  <div className="mt-3.5 flex items-center justify-between gap-2">
                    <SitePlanBadge plan={p.plan} />
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              </div>
            );
          })()
        ),
      )}
    </div>
  );
}

/* ──────────────────────────  shared bits  ────────────────────────── */

function IconButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-elevated)] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function FolderMenu({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Folder actions"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem className="text-[13px]" onSelect={onRename}>
          <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem className="text-[13px] text-destructive focus:text-destructive" onSelect={onDelete}>
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectMenu({
  projectId,
  folders,
  currentFolderId,
  onMove,
}: {
  projectId: string;
  folders: FolderType[];
  currentFolderId: string | null;
  onMove: (projectIds: string | string[], folderId: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="More actions"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[188px]">
        <DropdownMenuItem className="text-[13px]"><ExternalLink className="mr-2 h-3.5 w-3.5" /> Open</DropdownMenuItem>
        <DropdownMenuItem className="text-[13px]"><Eye className="mr-2 h-3.5 w-3.5" /> Preview</DropdownMenuItem>
        <DropdownMenuItem className="text-[13px]"><Send className="mr-2 h-3.5 w-3.5" /> Publish</DropdownMenuItem>
        <DropdownMenuItem className="text-[13px]"><Copy className="mr-2 h-3.5 w-3.5" /> Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-[13px]">
            <FolderInput className="mr-2 h-3.5 w-3.5" /> Move to folder
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="w-[180px]">
              {folders.length === 0 ? (
                <DropdownMenuItem disabled className="text-[13px]">No folders yet</DropdownMenuItem>
              ) : (
                folders.map((f) => (
                  <DropdownMenuItem key={f.id} className="text-[13px]" onSelect={() => onMove(projectId, f.id)}>
                    <Folder className="mr-2 h-3.5 w-3.5" />
                    <span className="flex-1 truncate">{f.name}</span>
                    {currentFolderId === f.id && <Check className="ml-2 h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))
              )}
              {currentFolderId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-[13px]" onSelect={() => onMove(projectId, null)}>
                    Remove from folder
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-[13px]"><Archive className="mr-2 h-3.5 w-3.5" /> Archive</DropdownMenuItem>
        <DropdownMenuItem className="text-[13px] text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ToolbarSelect({
  icon: Icon,
  label,
  items,
}: {
  icon: LucideIcon;
  label: string;
  items: Array<{ label: string; onSelect: () => void }>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:border-[color:var(--color-border-strong)]"
        >
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[180px]">
        {items.map((it) => (
          <DropdownMenuItem key={it.label} onSelect={it.onSelect} className="text-[13px]">
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ──────────────────────────  folder dialog  ────────────────────────── */

function FolderDialog({
  open,
  mode,
  initialName,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "rename";
  initialName: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New folder" : "Rename folder"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Group related projects together to keep your workspace tidy."
              : "Give this folder a clearer name."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            onSubmit(n);
            onOpenChange(false);
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marketing sites"
            maxLength={40}
          />
          <DialogFooter className="mt-5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center rounded-md px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              {mode === "create" ? "Create folder" : "Save changes"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────────  skeletons / empties  ────────────────────────── */

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[color:var(--color-elevated)] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-[color:color-mix(in_oklab,var(--foreground)_8%,transparent)] to-transparent" />
    </div>
  );
}

function ProjectsTableSkeleton({ rows }: { rows: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`grid ${LIST_COLS} items-center gap-5 border-b border-[color:var(--border-hairline)] px-3 py-4`}
        >
          <div className="flex items-center gap-3">
            <Shimmer className="h-9 w-14 rounded" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Shimmer className="h-3 w-[55%] rounded" />
              <Shimmer className="h-2.5 w-[80%] rounded" />
            </div>
          </div>
          <Shimmer className="h-3 w-14 rounded" />
          <Shimmer className="h-3 w-14 rounded" />
          <Shimmer className="h-3 w-14 rounded" />
          <Shimmer className="h-4 w-10 rounded" />
          <Shimmer className="h-4 w-4 rounded" />
        </div>
      ))}
    </div>
  );
}

function ProjectsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
          <Shimmer className="aspect-[16/10] w-full" />
          <div className="p-4">
            <div className="flex items-center gap-2.5">
              <Shimmer className="h-7 w-7 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Shimmer className="h-3 w-[50%] rounded" />
                <Shimmer className="h-2.5 w-[75%] rounded" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Shimmer className="h-3 w-24 rounded" />
              <Shimmer className="h-3 w-16 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExplorerEmpty({
  searching,
  inFolder,
  onClear,
}: {
  searching: boolean;
  inFolder: boolean;
  onClear: () => void;
}) {
  const title = searching ? "No matches" : inFolder ? "This folder is empty" : "Nothing here yet";
  const body = searching
    ? "No projects match your search."
    : inFolder
      ? "Move projects into this folder from the ⋯ menu on any project."
      : "Create a folder or a project to get started.";
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[color:var(--border-hairline)] px-3 py-14 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--color-elevated)] text-muted-foreground">
        {inFolder && !searching ? <Folder className="h-4 w-4" strokeWidth={1.75} /> : <Search className="h-4 w-4" strokeWidth={1.75} />}
      </div>
      <div>
        <div className="text-[13.5px] font-semibold text-foreground">{title}</div>
        <div className="mt-1 max-w-sm text-[12.5px] text-muted-foreground">{body}</div>
      </div>
      {searching && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-elevated)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
        >
          Clear search
        </button>
      )}
    </div>
  );
}

function EmptyProjects({ onNewProject }: { onNewProject: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-[color:var(--color-border)] bg-card px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-[color:color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
        <FolderKanban className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div>
        <div className="text-[15px] font-semibold text-foreground">No projects yet</div>
        <div className="mt-1 max-w-sm text-[13px] text-muted-foreground">
          Create your first website, import an existing one, or start from a template.
        </div>
      </div>
      <button
        type="button"
        onClick={onNewProject}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-[var(--primary-hover)]"
      >
        <Plus className="h-3.5 w-3.5" /> New project
      </button>
    </div>
  );
}
