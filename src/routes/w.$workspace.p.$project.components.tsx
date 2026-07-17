/**
 * Components hub — one library for every building block on the site.
 *
 * Built-in sections are registered in code and immutable here; hub-created
 * components are modeled visually (fields, variants, starter content) and
 * render through the token-driven generic renderer. The agent can draft new
 * components from a prompt and the brand kit; drafts never self-publish.
 * Decision record: COMPONENTS_PLAN.md.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Check, Code2, Copy, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/cms/layout";
import { ListToolbar, SegmentedFilter } from "@/components/cms/ListToolbar";
import {
  SectionPreview,
  SECTION_DEFS,
  type SectionDef,
} from "@/components/cms/editor/sections/SectionSystem";
import {
  componentCodeStub,
  componentHubActions,
  componentUsage,
  toSectionDef,
  useCustomComponents,
  type CustomComponent,
} from "@/lib/cms/components-store";
import { useBrandKit } from "@/lib/brand/brand-store";
import { aiAction } from "@/lib/billing/pricing";
import { agentRunActions, useAgentRuns } from "@/lib/agent/runs-store";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { canCompose, canSeeDeveloper, useEffectiveRole } from "@/lib/workspace/my-role";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/w/$workspace/p/$project/components")({
  component: ComponentsHub,
});

type StatusFilter = "all" | "builtin" | "published" | "draft" | "archived";

function ComponentsHub() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  const { effective } = useEffectiveRole(workspace);
  const canBuild = canSeeDeveloper(effective);
  const composer = canCompose(effective);

  const customs = useCustomComponents(pr.id);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null); // custom id or `builtin:${type}`
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = (name: string, blurb: string, category: string) =>
    !q || name.toLowerCase().includes(q) || blurb.toLowerCase().includes(q) || category.toLowerCase().includes(q);

  const builtins = SECTION_DEFS.filter((d) => matches(d.name, d.blurb, d.category));
  const filteredCustoms = customs.filter(
    (c) => (status === "all" ? c.status !== "archived" : c.status === status) && matches(c.name, c.blurb, c.category),
  );
  const counts = useMemo(
    () => ({
      all: SECTION_DEFS.length + customs.filter((c) => c.status !== "archived").length,
      builtin: SECTION_DEFS.length,
      published: customs.filter((c) => c.status === "published").length,
      draft: customs.filter((c) => c.status === "draft").length,
      archived: customs.filter((c) => c.status === "archived").length,
    }),
    [customs],
  );

  if (!composer) {
    return (
      <PageShell breadcrumbs={[{ label: workspace, to: "/w/$workspace", params: { workspace } }, { label: pr.name }, { label: "Components" }]} title="Components" description="">
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--s1)] px-6 py-14 text-center text-[13px] text-muted-foreground">
          Components are managed by admins, developers and marketers. Ask a workspace admin for access.
        </div>
      </PageShell>
    );
  }

  const openCustom = openId && !openId.startsWith("builtin:") ? customs.find((c) => c.id === openId) : undefined;
  const openBuiltin = openId?.startsWith("builtin:") ? SECTION_DEFS.find((d) => d.type === openId.slice(8)) : undefined;

  return (
    <PageShell
      breadcrumbs={[
        { label: workspace, to: "/w/$workspace", params: { workspace } },
        { label: pr.name, to: "/w/$workspace/p/$project/content", params: { workspace, project } },
        { label: "Components" },
      ]}
      title="Components"
      description="Every section your pages are built from, in one library. Built in code, modeled here."
      actions={
        canBuild ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setGenerating(true)}>
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Generate with AI
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New component
            </Button>
          </div>
        ) : undefined
      }
    >
      <ListToolbar query={query} onQuery={setQuery} placeholder="Search components">
        <SegmentedFilter<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { id: "all", label: "All", count: counts.all },
            { id: "builtin", label: "Built in", count: counts.builtin },
            { id: "published", label: "Published", count: counts.published },
            { id: "draft", label: "Drafts", count: counts.draft },
            { id: "archived", label: "Archived", count: counts.archived },
          ]}
        />
      </ListToolbar>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(status === "all" || status === "builtin") &&
          builtins.map((def) => (
            <ComponentCard
              key={def.type}
              def={def}
              usage={componentUsage(pr.id, def.type).count}
              badge={<Badge tone="code">Built in code</Badge>}
              onOpen={() => setOpenId(`builtin:${def.type}`)}
            />
          ))}
        {status !== "builtin" &&
          filteredCustoms.map((c) => (
            <ComponentCard
              key={c.id}
              def={toSectionDef(c)}
              usage={componentUsage(pr.id, c.type).count}
              badge={
                <span className="flex items-center gap-1.5">
                  {c.origin === "ai" && <Sparkles className="h-3 w-3 text-primary" />}
                  <Badge tone={c.status}>{c.status === "published" ? "Published" : c.status === "draft" ? "Draft" : "Archived"}</Badge>
                </span>
              }
              onOpen={() => setOpenId(c.id)}
            />
          ))}
      </div>
      {builtins.length === 0 && filteredCustoms.length === 0 && (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--s1)] px-6 py-14 text-center text-[13px] text-muted-foreground">
          No components match your search.
        </div>
      )}

      {openCustom && (
        <DetailPanel projectId={pr.id} custom={openCustom} canBuild={canBuild} onClose={() => setOpenId(null)} />
      )}
      {openBuiltin && (
        <DetailPanel projectId={pr.id} builtin={openBuiltin} canBuild={canBuild} onClose={() => setOpenId(null)} />
      )}
      {creating && (
        <NewComponentDialog
          onClose={() => setCreating(false)}
          onCreate={(input) => {
            const c = componentHubActions.create(pr.id, input);
            setCreating(false);
            setOpenId(c.id);
            toast.success(`${c.name} created as a draft`);
          }}
        />
      )}
      {generating && <GenerateDialog projectId={pr.id} onClose={() => setGenerating(false)} onOpen={(id) => setOpenId(id)} />}
    </PageShell>
  );
}

/* ------------------------------------------------------------------ card */

function Badge({ tone, children }: { tone: "code" | "draft" | "published" | "archived"; children: React.ReactNode }) {
  const cls = {
    code: "bg-[color:var(--s2)] text-muted-foreground",
    draft: "bg-amber-500/10 text-amber-600",
    published: "bg-emerald-500/10 text-emerald-600",
    archived: "bg-[color:var(--s2)] text-muted-foreground",
  }[tone];
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold", cls)}>{children}</span>;
}

function ComponentCard({ def, usage, badge, onOpen }: { def: SectionDef; usage: number; badge: React.ReactNode; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-card text-left transition-all hover:border-[color:var(--primary)] hover:shadow-[0_8px_30px_-12px_rgba(239,3,127,0.25)]"
    >
      <SectionPreview def={def} variant={def.variants[0]?.id ?? "default"} />
      <div className="border-t border-[color:var(--border-hairline)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
            <def.icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
              {def.name} {badge}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">{def.blurb}</div>
          </div>
          <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
            {usage === 0 ? "Unused" : usage === 1 ? "1 page" : `${usage} pages`}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ---------------------------------------------------------- detail panel */

function DetailPanel({
  projectId,
  custom,
  builtin,
  canBuild,
  onClose,
}: {
  projectId: string;
  custom?: CustomComponent;
  builtin?: SectionDef;
  canBuild: boolean;
  onClose: () => void;
}) {
  const def = custom ? toSectionDef(custom) : builtin!;
  const [variant, setVariant] = useState(def.variants[0]?.id ?? "default");
  const [showCode, setShowCode] = useState(false);
  const usage = componentUsage(projectId, def.type);
  const code = custom ? componentCodeStub(custom) : `// ${def.type} is registered in your repo.\n// See src/sections/${def.type}.tsx`;

  return createPortal(
    <div className="fixed inset-0 z-[92]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={def.name} className="absolute bottom-0 right-0 top-0 flex w-[min(680px,100vw)] flex-col overflow-hidden border-l border-[color:var(--color-border)] bg-[color:var(--s1)] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[color:var(--border-hairline)] bg-card px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              {def.name}
              {custom ? (
                <Badge tone={custom.status}>{custom.status === "published" ? "Published" : custom.status === "draft" ? "Draft" : "Archived"}</Badge>
              ) : (
                <Badge tone="code">Built in code</Badge>
              )}
              {custom?.origin === "ai" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                  <Sparkles className="h-3 w-3" /> AI drafted
                </span>
              )}
            </div>
            <div className="truncate text-[12px] text-muted-foreground">{def.blurb}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* preview + variant switcher */}
          <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-white">
            <SectionPreview def={def} variant={variant} />
          </div>
          {def.variants.length > 1 && (
            <div className="mt-2 flex gap-1.5">
              {def.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariant(v.id)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                    variant === v.id ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-primary" : "border-[color:var(--color-border)] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}

          {/* fields */}
          <SectionBlock title={`Fields · ${def.fields.length}`}>
            {def.fields.map((f) => (
              <div key={f.key} className="flex items-center gap-3 border-b border-[color:var(--border-hairline)] px-3.5 py-2.5 last:border-0">
                <span className="w-32 shrink-0 text-[12.5px] font-medium text-foreground">{f.label}</span>
                <code className="rounded bg-[color:var(--s2)] px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{f.key}</code>
                <span className="text-[11px] text-muted-foreground">{f.multiline ? "Long text" : "Text"}</span>
              </div>
            ))}
          </SectionBlock>

          {/* usage */}
          <SectionBlock title={usage.count === 0 ? "Not used on any page yet" : `Used on ${usage.count} ${usage.count === 1 ? "page" : "pages"}`}>
            {usage.pages.slice(0, 6).map((p) => (
              <div key={p.path} className="flex items-center justify-between border-b border-[color:var(--border-hairline)] px-3.5 py-2.5 text-[12.5px] last:border-0">
                <span className="font-medium text-foreground">{p.title}</span>
                <code className="font-mono text-[11px] text-muted-foreground">{p.path}</code>
              </div>
            ))}
            {usage.count === 0 && (
              <div className="px-3.5 py-3 text-[12px] text-muted-foreground">Add it from the section library in the visual editor.</div>
            )}
          </SectionBlock>

          {/* code */}
          <SectionBlock
            title="Code"
            action={
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => setShowCode((v) => !v)}>
                  <Code2 className="mr-1 h-3 w-3" /> {showCode ? "Hide" : "Show"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => { navigator.clipboard.writeText(code); toast.success("Code copied"); }}>
                  <Copy className="mr-1 h-3 w-3" /> Copy
                </Button>
              </div>
            }
          >
            {showCode ? (
              <pre className="max-h-64 overflow-auto bg-[color:var(--s2)] p-3.5 font-mono text-[11px] leading-relaxed text-foreground">{code}</pre>
            ) : (
              <div className="px-3.5 py-3 text-[12px] text-muted-foreground">
                {custom
                  ? "A starter component for your repo. Production rendering ships from code; this hub owns the model."
                  : "This section's component lives in your repo and is registered through the API."}
              </div>
            )}
          </SectionBlock>
        </div>

        {/* actions */}
        {canBuild && (
          <div className="flex items-center gap-2 border-t border-[color:var(--border-hairline)] bg-card px-5 py-3">
            {custom ? (
              <>
                {custom.status === "draft" && (
                  <Button size="sm" onClick={() => { componentHubActions.setStatus(projectId, custom.id, "published"); toast.success(`${custom.name} published to the library`); }}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Publish to library
                  </Button>
                )}
                {custom.status === "published" && (
                  <Button size="sm" variant="outline" onClick={() => { componentHubActions.setStatus(projectId, custom.id, "draft"); toast.success(`${custom.name} moved back to draft`); }}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Unpublish
                  </Button>
                )}
                {custom.status !== "archived" ? (
                  <Button size="sm" variant="outline" onClick={() => { componentHubActions.setStatus(projectId, custom.id, "archived"); toast.success(`${custom.name} archived`); }}>
                    <Archive className="mr-1 h-3.5 w-3.5" /> Archive
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { componentHubActions.setStatus(projectId, custom.id, "draft"); toast.success(`${custom.name} restored as a draft`); }}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (usage.count > 0) {
                      toast.error(`${custom.name} is used on ${usage.count} ${usage.count === 1 ? "page" : "pages"}. Remove it from those pages or archive it instead.`);
                      return;
                    }
                    if (componentHubActions.remove(projectId, custom.id)) {
                      toast.success(`${custom.name} deleted`);
                      onClose();
                    }
                  }}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </>
            ) : (
              <>
                <span className="text-[12px] text-muted-foreground">Registered in code. Duplicate it to customize a copy here.</span>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const c = componentHubActions.duplicate(projectId, builtin!);
                    toast.success(`${c.name} created as a draft`);
                    onClose();
                  }}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate to customize
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function SectionBlock({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-card">
      <div className="flex items-center justify-between border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3.5 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

/* --------------------------------------------------------- new component */

function NewComponentDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (input: { name: string; blurb: string; category: string; fields: { key: string; label: string; multiline?: boolean }[] }) => void }) {
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [category, setCategory] = useState("Content");
  const [fields, setFields] = useState<{ label: string; multiline: boolean }[]>([
    { label: "Heading", multiline: false },
    { label: "Body", multiline: true },
  ]);
  const valid = name.trim().length > 1 && fields.some((f) => f.label.trim());

  return createPortal(
    <div className="fixed inset-0 z-[94]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="New component" className="absolute left-1/2 top-[8vh] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-card shadow-2xl">
        <div className="border-b border-[color:var(--border-hairline)] px-5 py-3.5 text-[14px] font-semibold text-foreground">New component</div>
        <div className="max-h-[62vh] space-y-4 overflow-y-auto px-5 py-4">
          <Field label="Name">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Stats band" className="h-9 w-full rounded-md border border-[color:var(--color-border)] bg-card px-2.5 text-[13px] outline-none focus:border-[color:var(--primary)]" />
          </Field>
          <Field label="What it's for">
            <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Three headline numbers with labels" className="h-9 w-full rounded-md border border-[color:var(--color-border)] bg-card px-2.5 text-[13px] outline-none focus:border-[color:var(--primary)]" />
          </Field>
          <Field label="Category">
            <div className="flex gap-1.5">
              {["Hero", "Content", "Social proof", "Conversion"].map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} className={cn("rounded-md border px-2.5 py-1.5 text-[12px] font-medium", category === c ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-primary" : "border-[color:var(--color-border)] text-muted-foreground")}>
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <Field label={`Fields · ${fields.length}`}>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={f.label}
                    onChange={(e) => setFields((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    placeholder="Field label"
                    className="h-8 flex-1 rounded-md border border-[color:var(--color-border)] bg-card px-2.5 text-[12.5px] outline-none focus:border-[color:var(--primary)]"
                  />
                  <button type="button" onClick={() => setFields((arr) => arr.map((x, j) => (j === i ? { ...x, multiline: !x.multiline } : x)))} className={cn("rounded-md border px-2 py-1 text-[11px] font-medium", f.multiline ? "border-[color:var(--primary)] text-primary" : "border-[color:var(--color-border)] text-muted-foreground")}>
                    {f.multiline ? "Long text" : "Text"}
                  </button>
                  <button type="button" aria-label="Remove field" onClick={() => setFields((arr) => arr.filter((_, j) => j !== i))} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setFields((arr) => [...arr, { label: "", multiline: false }])}>
                <Plus className="mr-1 h-3 w-3" /> Add field
              </Button>
            </div>
          </Field>
        </div>
        <div className="flex items-center justify-between border-t border-[color:var(--border-hairline)] px-5 py-3">
          <span className="text-[11.5px] text-muted-foreground">Starts as a draft. Publish it when it's ready for the library.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={!valid}
              onClick={() =>
                onCreate({
                  name,
                  blurb,
                  category,
                  fields: fields
                    .filter((f) => f.label.trim())
                    .map((f, i) => ({ key: f.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `field_${i}`, label: f.label.trim(), multiline: f.multiline || undefined })),
                })
              }
            >
              Create draft
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ AI dialog */

function GenerateDialog({ projectId, onClose, onOpen }: { projectId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const runs = useAgentRuns(projectId);
  const run = runId ? runs.find((r) => r.id === runId) : undefined;
  const brand = useBrandKit(projectId);
  const credits = aiAction("section")?.costs.balanced ?? 30;
  const done = run?.status === "done";
  const draftId = done ? run?.undo?.find((u) => u.kind === "removeComponent")?.componentId : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[94]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={run && !done ? undefined : onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Generate a component" className="absolute left-1/2 top-[10vh] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[color:var(--border-hairline)] px-5 py-3.5">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[14px] font-semibold text-foreground">Generate a component</span>
        </div>

        {!runId ? (
          <>
            <div className="space-y-4 px-5 py-4">
              <textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="A stats band with three headline numbers and a short heading"
                className="w-full resize-none rounded-lg border border-[color:var(--color-border)] bg-card px-3 py-2.5 text-[13px] outline-none focus:border-[color:var(--primary)]"
              />
              <div className="rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s1)] px-3.5 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Grounded in your brand kit</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {[brand.colors.primary, brand.colors.accent, brand.colors.surface].filter(Boolean).map((c) => (
                    <span key={c} className="flex items-center gap-1.5 rounded-md border border-[color:var(--color-border)] px-2 py-1 text-[11px] font-medium text-muted-foreground">
                      <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: c }} /> {c}
                    </span>
                  ))}
                  <span className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-[11px] font-medium text-muted-foreground">{brand.typography.headingFont}</span>
                  <span className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-[11px] font-medium text-muted-foreground">Brand voice</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[color:var(--border-hairline)] px-5 py-3">
              <span className="text-[11.5px] text-muted-foreground">This run will use about {credits} credits. Lands as a draft, never publishes itself.</span>
              <Button
                size="sm"
                disabled={prompt.trim().length < 8}
                onClick={() => {
                  const id = agentRunActions.startComponentGenerator({ projectId, config: { prompt } });
                  if (id) setRunId(id);
                  else toast.error("Component generation is turned off for this workspace.");
                }}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Generate draft
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2.5 px-5 py-4">
              {run?.steps.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 text-[13px]">
                  {s.status === "done" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--primary)]/25 border-t-[color:var(--primary)]" />
                  )}
                  <span className={s.status === "done" ? "text-muted-foreground" : "text-foreground"}>{s.label}</span>
                </div>
              ))}
              {done && (
                <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-[12.5px] text-foreground">
                  Draft ready. It used {run?.creditsSpent} credits and is waiting in the library as a draft, with one-click undo in the agent history.
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-5 py-3">
              <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
              {done && draftId && (
                <Button size="sm" onClick={() => { onClose(); onOpen(draftId); }}>
                  Open the draft
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
