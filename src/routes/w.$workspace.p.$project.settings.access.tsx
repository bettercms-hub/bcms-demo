import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, Lock, Plus, ShieldCheck, Trash2, UserPlus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SettingsSection, EmptyState } from "@/components/cms/SettingsSubNav";
import { RolePermissionMatrix } from "@/components/cms/ui/RolePermissionMatrix";
import { ProjectAccessTable } from "@/components/cms/workspace/ProjectAccessTable";
import { useWorkspaceRow } from "@/lib/workspace/queries";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { getCMSState } from "@/lib/cms/store";
import { getPages } from "@/lib/cms/pages-store";
import { SECTION_DEFS } from "@/components/cms/editor/sections/SectionSystem";
import {
  BASE_ROLE_META,
  customRoleActions,
  customRolesAllowed,
  scopeLabel,
  sectionDepthAllowed,
  useCustomRoles,
  type BaseRole,
  type RoleScope,
} from "@/lib/workspace/custom-roles-store";
import type { SitePlanId } from "@/lib/cms/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/access")({
  component: Access,
});

function Access() {
  const { workspace, project } = Route.useParams();
  const { data: ws } = useWorkspaceRow(workspace);
  const pr = getProjectBySlug(workspace, project);
  const [matrixOpen, setMatrixOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Access"
        description="Who can view, edit, and publish on this project."
        action={
          <Button size="sm" className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> Invite member
          </Button>
        }
      />

      {/* Who can manage access — the permission model, stated up front. */}
      <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-[12.5px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Only the Owner and Site managers</span> can invite or remove
          members, change roles, and create custom roles. Everyone else can see the team but not modify it. Ownership can
          be transferred in workspace settings.
        </div>
      </div>

      <Tabs defaultValue="members" className="mb-8">
        <TabsList className="mb-6">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <SettingsSection
            title="Project members"
            description="Per-project role overrides. Members without an override use their workspace role."
            flush
          >
            <div className="px-5 py-4">
              <ProjectAccessTable workspaceId={ws?.id} projectSlug={project} />
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="roles">
          <RolesTab projectId={pr?.id ?? ""} sitePlan={pr?.sitePlan ?? "free"} workspace={workspace} project={project} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLog />
        </TabsContent>
      </Tabs>

      <section className="mb-8">
        <button
          onClick={() => setMatrixOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-5 py-3 text-left hover:bg-[color:var(--color-row-hover)]"
        >
          <div>
            <div className="text-[14px] font-semibold text-foreground">Permission matrix</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              What each role can do on this project's resources.
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${matrixOpen ? "rotate-180" : ""}`} />
        </button>
        {matrixOpen && (
          <div className="mt-2 rounded-lg border border-border bg-background px-5 py-3">
            <RolePermissionMatrix />
          </div>
        )}
      </section>
    </>
  );
}

/* ───────────────────────────── Roles ──────────────────────────────────── */

function RolesTab({
  projectId,
  sitePlan,
  workspace,
  project,
}: {
  projectId: string;
  sitePlan: SitePlanId;
  workspace: string;
  project: string;
}) {
  const roles = useCustomRoles(projectId);
  const [newOpen, setNewOpen] = useState(false);
  const allowed = customRolesAllowed(sitePlan);

  if (!allowed) {
    return (
      <SettingsSection
        title="Custom roles"
        description="Granular access: scope a seat to specific collections, pages, and elements."
        flush
      >
        <div className="px-5 py-10 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--s2)] text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-foreground">Custom roles are on Team and Enterprise</p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-muted-foreground">
            Create roles like "Blog author" that can edit one collection and nothing else, or scope a seat to specific
            pages. Element level access is part of Enterprise.
          </p>
          <Link
            to="/w/$workspace/p/$project/settings/plan"
            params={{ workspace, project }}
            className="mt-4 inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
          >
            See plans
          </Link>
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Custom roles"
      description="Start from a built-in role, then narrow exactly what it can touch."
      action={
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New role
        </Button>
      }
      flush
    >
      <div className="divide-y divide-[color:var(--border-hairline)]">
        {roles.length === 0 && (
          <div className="px-5 py-8">
            <EmptyState
              title="No custom roles yet"
              description="Create one to scope a seat to specific collections, pages, or elements."
            />
          </div>
        )}
        {roles.map((r) => (
          <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s3)]">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-medium text-foreground">{r.name}</span>
                <span className="rounded border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {BASE_ROLE_META[r.base].label} base
                </span>
              </div>
              {r.description && <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{r.description}</div>}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <ScopeChip label={scopeLabel(r.scope.collections, "collection")} narrowed={r.scope.collections !== "all"} />
                <ScopeChip label={scopeLabel(r.scope.pages, "page")} narrowed={r.scope.pages !== "all"} />
                <ScopeChip label={scopeLabel(r.scope.sections, "element")} narrowed={r.scope.sections !== "all"} />
                {r.capabilities.publish ? <ScopeChip label="Can publish" narrowed /> : <ScopeChip label="No publish" />}
              </div>
            </div>
            <div className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
              {r.members} {r.members === 1 ? "member" : "members"}
            </div>
            <button
              type="button"
              onClick={() => {
                customRoleActions.remove(projectId, r.id);
                toast.success(`Role "${r.name}" deleted. Members fall back to their workspace role.`);
              }}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
              title="Delete role"
              aria-label={`Delete ${r.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {newOpen && (
        <NewCustomRoleDialog
          projectId={projectId}
          sitePlan={sitePlan}
          onClose={() => setNewOpen(false)}
        />
      )}
    </SettingsSection>
  );
}

function ScopeChip({ label, narrowed }: { label: string; narrowed?: boolean }) {
  return (
    <span
      className={
        narrowed
          ? "inline-flex items-center rounded-md bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] px-1.5 py-0.5 text-[10.5px] font-medium text-primary"
          : "inline-flex items-center rounded-md bg-[color:var(--s2)] px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground"
      }
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------ new custom role dialog */

function NewCustomRoleDialog({
  projectId,
  sitePlan,
  onClose,
}: {
  projectId: string;
  sitePlan: SitePlanId;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [base, setBase] = useState<BaseRole>("editor");
  const [caps, setCaps] = useState({ edit: true, publish: false, seo: false, agent: true, generate: false, markdown: false });
  const [collections, setCollections] = useState<RoleScope>("all");
  const [pages, setPages] = useState<RoleScope>("all");
  const [sections, setSections] = useState<RoleScope>("all");

  const s = getCMSState();
  const collectionOptions = useMemo(
    () => s.collections.filter((c) => c.projectId === projectId).map((c) => ({ id: c.id, label: c.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId],
  );
  const pageOptions = useMemo(
    () => getPages(projectId).map((p) => ({ id: p.path, label: `${p.title} (${p.path})` })),
    [projectId],
  );
  const sectionOptions = useMemo(() => SECTION_DEFS.map((d) => ({ id: d.type, label: d.name })), []);
  const deepAllowed = sectionDepthAllowed(sitePlan);

  const create = () => {
    customRoleActions.add(projectId, {
      name: name.trim(),
      description: description.trim(),
      base,
      capabilities: caps,
      scope: { collections, pages, sections: deepAllowed ? sections : "all" },
    });
    toast.success(`Role "${name.trim()}" created`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New custom role</DialogTitle>
          <DialogDescription>Start from a base role, then narrow what it can touch.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blog author" className="h-9" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="h-9" />
            </div>
          </div>

          {/* base role */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground">Starts from</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(Object.keys(BASE_ROLE_META) as BaseRole[]).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBase(b)}
                  aria-pressed={base === b}
                  className={
                    base === b
                      ? "rounded-lg border border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)] px-2.5 py-2 text-left"
                      : "rounded-lg border border-[color:var(--color-border)] px-2.5 py-2 text-left hover:bg-[color:var(--color-row-hover)]"
                  }
                >
                  <span className="block text-[12px] font-medium text-foreground">{BASE_ROLE_META[b].label}</span>
                  <span className="block text-[10.5px] leading-snug text-muted-foreground">{BASE_ROLE_META[b].blurb}</span>
                </button>
              ))}
            </div>
          </div>

          {/* capabilities */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground">Can</label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(
                [
                  ["edit", "Edit content"],
                  ["publish", "Publish"],
                  ["seo", "Manage SEO"],
                  ["agent", "Use the agent"],
                  ["generate", "Generate pages"],
                  ["markdown", "Manage markdown"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-[color:var(--border-hairline)] px-2.5 py-2 text-[12.5px] hover:bg-[color:var(--color-row-hover)]"
                >
                  <Checkbox checked={caps[key]} onCheckedChange={() => setCaps((c) => ({ ...c, [key]: !c[key] }))} />
                  <span className="text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* scopes */}
          <ScopePicker label="Collections" hint="Which collections this role can open" options={collectionOptions} value={collections} onChange={setCollections} />
          <ScopePicker label="Pages" hint="Which pages this role can open" options={pageOptions} value={pages} onChange={setPages} />
          {deepAllowed ? (
            <ScopePicker label="Elements" hint="Which section types this role can edit on a page" options={sectionOptions} value={sections} onChange={setSections} />
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-[color:var(--color-border)] px-3 py-2.5">
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-foreground">Element level access</span>
                <span className="block text-[11px] text-muted-foreground">
                  Scope a role down to specific section types, like only the FAQ. Available on Enterprise.
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!name.trim()} onClick={create}>
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "All" switch plus a checklist when narrowed. */
function ScopePicker({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  options: { id: string; label: string }[];
  value: RoleScope;
  onChange: Dispatch<SetStateAction<RoleScope>>;
}) {
  const narrowed = value !== "all";
  const selected = narrowed ? new Set(value) : null;

  return (
    <div className="rounded-lg border border-[color:var(--border-hairline)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-[12.5px] font-semibold text-foreground">{label}</span>
          <span className="block text-[11px] text-muted-foreground">{hint}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(narrowed ? "all" : [])}
          aria-pressed={!narrowed}
          className={
            narrowed
              ? "shrink-0 rounded-md border border-[color:var(--color-border)] px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
              : "shrink-0 rounded-md border border-[color:color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] px-2 py-1 text-[11.5px] font-medium text-primary"
          }
        >
          {narrowed ? "Limit on" : `All ${label.toLowerCase()}`}
        </button>
      </div>
      {narrowed && (
        <div className="mt-2 grid max-h-[132px] grid-cols-2 gap-1 overflow-y-auto">
          {options.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[12px] hover:bg-[color:var(--color-row-hover)]"
            >
              <Checkbox
                checked={selected?.has(o.id) ?? false}
                onCheckedChange={() => {
                  onChange((prev) => {
                    const next = new Set(prev === "all" ? [] : prev);
                    if (next.has(o.id)) next.delete(o.id);
                    else next.add(o.id);
                    return [...next];
                  });
                }}
              />
              <span className="truncate text-foreground">{o.label}</span>
            </label>
          ))}
          {options.length === 0 && <p className="col-span-2 px-2 py-1 text-[11.5px] text-muted-foreground">Nothing here yet.</p>}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Audit log ────────────────────────────────── */

interface AuditEntry {
  actor: string;
  action: string;
  target: string;
  minsAgo: number;
}

const AUDIT_ENTRIES: AuditEntry[] = [
  { actor: "Alex Rivera", action: "changed role", target: "Priya Singh → Content editor", minsAgo: 35 },
  { actor: "You", action: "invited member", target: "jordan@acme.co (Viewer)", minsAgo: 190 },
  { actor: "Alex Rivera", action: "created role", target: "Content reviewer", minsAgo: 1500 },
  { actor: "Devon Lee", action: "published", target: "Blog · /blog/launch-week", minsAgo: 1600 },
  { actor: "Priya Singh", action: "removed member", target: "contractor@ext.io", minsAgo: 2700 },
  { actor: "You", action: "granted project access", target: "Sam Okafor → Marketer", minsAgo: 4300 },
  { actor: "Alex Rivera", action: "updated permissions", target: "Marketer role", minsAgo: 5900 },
  { actor: "Devon Lee", action: "rotated API key", target: "Server key · prod", minsAgo: 7300 },
  { actor: "You", action: "changed role", target: "Marko Hahn → Viewer", minsAgo: 8800 },
  { actor: "Priya Singh", action: "published", target: "Pricing · /pricing", minsAgo: 10200 },
  { actor: "Alex Rivera", action: "invited member", target: "design@acme.co (Content editor)", minsAgo: 12800 },
  { actor: "Sam Okafor", action: "requested review", target: "Home · /", minsAgo: 15000 },
];

function timeAgo(mins: number) {
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function AuditLog() {
  const [shown, setShown] = useState(6);
  const rows = AUDIT_ENTRIES.slice(0, shown);
  const hasMore = shown < AUDIT_ENTRIES.length;

  const initials = (n: string) => (n === "You" ? "You" : n.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase());

  return (
    <SettingsSection
      title="Audit log"
      description="Access, role, and permission changes on this project."
      flush
      action={
        <button
          type="button"
          onClick={() => toast.success("Audit log exported (demo)")}
          className="text-[12px] font-medium text-primary hover:underline"
        >
          Export
        </button>
      }
    >
      <table className="w-full text-[13px]">
        <thead className="border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)]/40 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          <tr>
            <th className="px-5 py-2.5 text-left font-medium">Actor</th>
            <th className="px-3 py-2.5 text-left font-medium">Action</th>
            <th className="px-3 py-2.5 text-left font-medium">Target</th>
            <th className="px-5 py-2.5 text-right font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={i} className="border-b border-[color:var(--border-hairline)] last:border-b-0">
              <td className="px-5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--s3)] text-[10px] font-semibold text-muted-foreground">
                    {initials(e.actor)}
                  </span>
                  <span className="font-medium text-foreground">{e.actor}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{e.action}</td>
              <td className="px-3 py-2.5 text-foreground">{e.target}</td>
              <td className="whitespace-nowrap px-5 py-2.5 text-right text-muted-foreground">{timeAgo(e.minsAgo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-[12px] text-muted-foreground">
          Showing {rows.length} of {AUDIT_ENTRIES.length}
        </span>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShown((s) => s + 6)}
            className="inline-flex h-8 items-center rounded-lg border border-border bg-transparent px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            Load more
          </button>
        )}
      </div>
    </SettingsSection>
  );
}
