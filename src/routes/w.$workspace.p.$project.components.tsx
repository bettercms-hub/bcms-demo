/**
 * Components hub — one library for every building block on the site.
 *
 * Gallery and list views over built-in + hub-created components, a two-pane
 * visual builder with typed fields (text, long text, image, number, link,
 * slot) and a live preview, and a conversational AI studio: iterate on a
 * draft across turns, attach references and skills, tweak the brand inline.
 * Every generation spends credits and is logged as a browsable chat.
 * Decision record: COMPONENTS_PLAN.md.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  AtSign,
  Check,
  Code2,
  Copy,
  LayoutGrid,
  List,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/cms/layout";
import { ListToolbar, SegmentedFilter } from "@/components/cms/ListToolbar";
import { SectionPreview, SECTION_DEFS, type SectionDef } from "@/components/cms/editor/sections/SectionSystem";
import {
  COMPONENT_ICONS,
  FIELD_TYPES,
  buildComponentDraft,
  componentChatActions,
  componentCodeStub,
  componentHubActions,
  componentIcon,
  componentUsage,
  iterateComponent,
  slotTargets,
  toSectionDef,
  useComponentChats,
  useCustomComponents,
  type ChatAttachment,
  type CustomComponent,
  type CustomField,
} from "@/lib/cms/components-store";
import { brandActions, useBrandKit } from "@/lib/brand/brand-store";
import { aiAction } from "@/lib/billing/pricing";
import { enabledInstructions } from "@/lib/agent/instructions-store";
import { recordAgentAudit } from "@/lib/cms/store";
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
  const [view, setView] = useState<"grid" | "list">("grid");
  const [openId, setOpenId] = useState<string | null>(null);
  const [builder, setBuilder] = useState<{ editId?: string } | null>(null);
  const [studio, setStudio] = useState(false);

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
  const showBuiltins = status === "all" || status === "builtin";
  const showCustoms = status !== "builtin";

  const tryDelete = (c: CustomComponent) => {
    const usage = componentUsage(pr.id, c.type);
    if (usage.count > 0) {
      toast.error(`${c.name} is used on ${usage.count} ${usage.count === 1 ? "page" : "pages"}. Remove it from those pages or archive it instead.`);
      return;
    }
    if (componentHubActions.remove(pr.id, c.id)) {
      toast.success(`${c.name} deleted`);
      if (openId === c.id) setOpenId(null);
    }
  };

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
            <Button size="sm" variant="outline" onClick={() => setStudio(true)}>
              <Sparkles className="mr-1 h-3.5 w-3.5" /> AI studio
            </Button>
            <Button size="sm" onClick={() => setBuilder({})}>
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
        <div className="flex rounded-lg border border-[color:var(--color-border)] p-0.5">
          {(
            [
              { id: "grid", icon: LayoutGrid, label: "Gallery view" },
              { id: "list", icon: List, label: "List view" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              aria-label={v.label}
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={cn("grid h-7 w-8 place-items-center rounded-md transition-colors", view === v.id ? "bg-[color:var(--s2)] text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <v.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </ListToolbar>

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {showBuiltins &&
            builtins.map((def) => (
              <ComponentCard key={def.type} def={def} usage={componentUsage(pr.id, def.type).count} badge={<Badge tone="code">Built in code</Badge>} onOpen={() => setOpenId(`builtin:${def.type}`)} />
            ))}
          {showCustoms &&
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
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
          <div className="grid grid-cols-[1fr_90px_110px] items-center gap-3 border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[1fr_110px_90px_80px_120px]">
            <span>Component</span>
            <span className="hidden sm:block">Category</span>
            <span>Status</span>
            <span className="hidden sm:block">Usage</span>
            <span />
          </div>
          <ul className="divide-y divide-[color:var(--border-hairline)]">
            {showBuiltins &&
              builtins.map((def) => (
                <ListRow key={def.type} icon={def.icon} name={def.name} blurb={def.blurb} category={def.category} usage={componentUsage(pr.id, def.type).count} badge={<Badge tone="code">Built in</Badge>} onOpen={() => setOpenId(`builtin:${def.type}`)}>
                  <span className="text-[11px] text-muted-foreground">In code</span>
                </ListRow>
              ))}
            {showCustoms &&
              filteredCustoms.map((c) => (
                <ListRow key={c.id} icon={componentIcon(c.iconId)} name={c.name} blurb={c.blurb} category={c.category} usage={componentUsage(pr.id, c.type).count} badge={<Badge tone={c.status}>{c.status === "published" ? "Published" : c.status === "draft" ? "Draft" : "Archived"}</Badge>} onOpen={() => setOpenId(c.id)}>
                  {canBuild && (
                    <span className="flex items-center justify-end gap-1">
                      <button type="button" aria-label={`Edit ${c.name}`} onClick={(e) => { e.stopPropagation(); setBuilder({ editId: c.id }); }} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label={`Delete ${c.name}`} onClick={(e) => { e.stopPropagation(); tryDelete(c); }} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </ListRow>
              ))}
          </ul>
        </div>
      )}
      {builtins.length === 0 && filteredCustoms.length === 0 && (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--s1)] px-6 py-14 text-center text-[13px] text-muted-foreground">No components match your search.</div>
      )}

      {openCustom && <DetailPanel projectId={pr.id} custom={openCustom} canBuild={canBuild} onClose={() => setOpenId(null)} onEdit={() => { setBuilder({ editId: openCustom.id }); setOpenId(null); }} onDelete={() => tryDelete(openCustom)} />}
      {openBuiltin && <DetailPanel projectId={pr.id} builtin={openBuiltin} canBuild={canBuild} onClose={() => setOpenId(null)} />}
      {builder && (
        <BuilderOverlay
          projectId={pr.id}
          existing={builder.editId ? customs.find((c) => c.id === builder.editId) : undefined}
          onClose={() => setBuilder(null)}
          onSaved={(id) => {
            setBuilder(null);
            setOpenId(id);
          }}
        />
      )}
      {studio && <StudioOverlay projectId={pr.id} workspaceId={pr.workspaceId} onClose={() => setStudio(false)} onOpenComponent={(id) => { setStudio(false); setOpenId(id); }} />}
    </PageShell>
  );
}

/* ------------------------------------------------------------ shared bits */

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
    <button type="button" onClick={onOpen} className="group overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-card text-left transition-all hover:border-[color:var(--primary)] hover:shadow-[0_8px_30px_-12px_rgba(239,3,127,0.25)]">
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
          <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">{usage === 0 ? "Unused" : usage === 1 ? "1 page" : `${usage} pages`}</span>
        </div>
      </div>
    </button>
  );
}

function ListRow({ icon: Icon, name, blurb, category, usage, badge, onOpen, children }: { icon: React.ComponentType<{ className?: string }>; name: string; blurb: string; category: string; usage: number; badge: React.ReactNode; onOpen: () => void; children?: React.ReactNode }) {
  return (
    <li onClick={onOpen} className="grid cursor-pointer grid-cols-[1fr_90px_110px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--s4)] sm:grid-cols-[1fr_110px_90px_80px_120px]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">{name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{blurb}</div>
        </div>
      </div>
      <span className="hidden text-[12px] text-muted-foreground sm:block">{category}</span>
      <span>{badge}</span>
      <span className="hidden text-[11.5px] tabular-nums text-muted-foreground sm:block">{usage === 0 ? "Unused" : `${usage} ${usage === 1 ? "page" : "pages"}`}</span>
      {children ?? <span />}
    </li>
  );
}

/* ---------------------------------------------------------- detail panel */

function DetailPanel({ projectId, custom, builtin, canBuild, onClose, onEdit, onDelete }: { projectId: string; custom?: CustomComponent; builtin?: SectionDef; canBuild: boolean; onClose: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const def = custom ? toSectionDef(custom) : builtin!;
  const [variant, setVariant] = useState(def.variants[0]?.id ?? "default");
  const [showCode, setShowCode] = useState(false);
  const usage = componentUsage(projectId, def.type);
  const code = custom ? componentCodeStub(custom) : `// ${def.type} is registered in your repo.\n// See src/sections/${def.type}.tsx`;
  const typeLabel = (f: CustomField) => FIELD_TYPES.find((t) => t.id === f.type)?.label ?? "Text";

  return createPortal(
    <div className="fixed inset-0 z-[92]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={def.name} className="absolute bottom-0 right-0 top-0 flex w-[min(680px,100vw)] flex-col overflow-hidden border-l border-[color:var(--color-border)] bg-[color:var(--s1)] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[color:var(--border-hairline)] bg-card px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              {def.name}
              {custom ? <Badge tone={custom.status}>{custom.status === "published" ? "Published" : custom.status === "draft" ? "Draft" : "Archived"}</Badge> : <Badge tone="code">Built in code</Badge>}
              {custom?.origin === "ai" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                  <Sparkles className="h-3 w-3" /> AI drafted
                </span>
              )}
            </div>
            <div className="truncate text-[12px] text-muted-foreground">{def.blurb}</div>
          </div>
          {custom && canBuild && onEdit && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-white">
            <SectionPreview def={def} variant={variant} />
          </div>
          {def.variants.length > 1 && (
            <div className="mt-2 flex gap-1.5">
              {def.variants.map((v) => (
                <button key={v.id} type="button" onClick={() => setVariant(v.id)} className={cn("rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors", variant === v.id ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-primary" : "border-[color:var(--color-border)] text-muted-foreground hover:text-foreground")}>
                  {v.name}
                </button>
              ))}
            </div>
          )}

          <SectionBlock title={`Fields · ${custom ? custom.fields.length : def.fields.length}`}>
            {(custom?.fields ?? def.fields.map((f) => ({ key: f.key, label: f.label, type: (f.multiline ? "longtext" : "text") as CustomField["type"] }))).map((f) => (
              <div key={f.key} className="flex items-center gap-3 border-b border-[color:var(--border-hairline)] px-3.5 py-2.5 last:border-0">
                <span className="w-32 shrink-0 text-[12.5px] font-medium text-foreground">{f.label}</span>
                <code className="rounded bg-[color:var(--s2)] px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{f.key}</code>
                <span className="text-[11px] text-muted-foreground">{typeLabel(f as CustomField)}</span>
              </div>
            ))}
          </SectionBlock>

          <SectionBlock title={usage.count === 0 ? "Not used on any page yet" : `Used on ${usage.count} ${usage.count === 1 ? "page" : "pages"}`}>
            {usage.pages.slice(0, 6).map((p) => (
              <div key={p.path} className="flex items-center justify-between border-b border-[color:var(--border-hairline)] px-3.5 py-2.5 text-[12.5px] last:border-0">
                <span className="font-medium text-foreground">{p.title}</span>
                <code className="font-mono text-[11px] text-muted-foreground">{p.path}</code>
              </div>
            ))}
            {usage.count === 0 && <div className="px-3.5 py-3 text-[12px] text-muted-foreground">Add it from the section library in the visual editor.</div>}
          </SectionBlock>

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
              <div className="px-3.5 py-3 text-[12px] text-muted-foreground">{custom ? "A starter component for your repo. Production rendering ships from code; this hub owns the model." : "This section's component lives in your repo and is registered through the API."}</div>
            )}
          </SectionBlock>
        </div>

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
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </>
            ) : (
              <>
                <span className="text-[12px] text-muted-foreground">Registered in code. Duplicate it to customize a copy here.</span>
                <div className="flex-1" />
                <Button size="sm" variant="outline" onClick={() => { const c = componentHubActions.duplicate(projectId, builtin!); toast.success(`${c.name} created as a draft`); onClose(); }}>
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

/* --------------------------------------------------------------- builder */

function BuilderOverlay({ projectId, existing, onClose, onSaved }: { projectId: string; existing?: CustomComponent; onClose: () => void; onSaved: (id: string) => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [blurb, setBlurb] = useState(existing?.blurb ?? "");
  const [category, setCategory] = useState(existing?.category ?? "Content");
  const [iconId, setIconId] = useState(existing?.iconId ?? "sparkles");
  const [fields, setFields] = useState<CustomField[]>(existing?.fields.map((f) => ({ ...f })) ?? [
    { key: "heading", label: "Heading", type: "text" },
    { key: "body", label: "Body", type: "longtext" },
  ]);
  const [defaults, setDefaults] = useState<Record<string, string>>({ ...(existing?.defaults ?? { heading: "A heading to edit", body: "Supporting copy your editors will replace." }) });
  const [leftLayout, setLeftLayout] = useState(existing ? existing.variants.some((v) => v.id === "left") : true);
  const [variant, setVariant] = useState("centered");
  const valid = name.trim().length > 1 && fields.some((f) => f.label.trim());
  const targets = slotTargets(projectId);

  // Live preview object, recomputed every keystroke.
  const preview: CustomComponent = {
    id: existing?.id ?? "cmp_preview",
    projectId,
    type: existing?.type ?? "preview",
    name: name || "New component",
    blurb,
    category,
    status: "draft",
    origin: existing?.origin ?? "manual",
    iconId,
    fields: fields.filter((f) => f.label.trim()),
    variants: leftLayout ? [{ id: "centered", name: "Centered" }, { id: "left", name: "Left aligned" }] : [{ id: "centered", name: "Centered" }],
    defaults,
    createdAt: 0,
    updatedAt: 0,
  };

  const setField = (i: number, up: Partial<CustomField>) =>
    setFields((arr) =>
      arr.map((f, j) => {
        if (j !== i) return f;
        const next = { ...f, ...up };
        if (up.label !== undefined) next.key = existing?.fields[j]?.key ?? (up.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `field_${i}`);
        return next;
      }),
    );

  const save = () => {
    const clean = fields.filter((f) => f.label.trim());
    if (existing) {
      componentHubActions.update(projectId, existing.id, { name: name.trim(), blurb: blurb.trim() || preview.blurb, category, iconId, fields: clean, defaults, variants: preview.variants });
      toast.success(`${name.trim()} saved`);
      onSaved(existing.id);
    } else {
      const c = componentHubActions.create(projectId, { name, blurb, category, iconId, fields: clean, defaults, variants: preview.variants });
      toast.success(`${c.name} created as a draft`);
      onSaved(c.id);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[94] bg-[color:var(--s1)]">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-[color:var(--border-hairline)] bg-card px-5 py-3">
          <span className="text-[15px] font-semibold text-foreground">{existing ? `Edit ${existing.name}` : "New component"}</span>
          <span className="hidden text-[12px] text-muted-foreground sm:block">The preview updates as you type. Saves as a draft until you publish.</span>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={save}>{existing ? "Save changes" : "Create draft"}</Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* settings pane */}
          <div className="w-full shrink-0 space-y-5 overflow-y-auto border-b border-[color:var(--border-hairline)] p-5 md:w-[420px] md:border-b-0 md:border-r">
            <Field label="Name">
              <input autoFocus={!existing} value={name} onChange={(e) => setName(e.target.value)} placeholder="Stats band" className="h-9 w-full rounded-md border border-[color:var(--color-border)] bg-card px-2.5 text-[13px] outline-none focus:border-[color:var(--primary)]" />
            </Field>
            <Field label="What it's for">
              <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Three headline numbers with labels" className="h-9 w-full rounded-md border border-[color:var(--color-border)] bg-card px-2.5 text-[13px] outline-none focus:border-[color:var(--primary)]" />
            </Field>
            <Field label="Category">
              <div className="flex flex-wrap gap-1.5">
                {["Hero", "Content", "Social proof", "Conversion"].map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(c)} className={cn("rounded-md border px-2.5 py-1.5 text-[12px] font-medium", category === c ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-primary" : "border-[color:var(--color-border)] text-muted-foreground")}>
                    {c}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Icon">
              <div className="flex flex-wrap gap-1.5">
                {COMPONENT_ICONS.map((i) => (
                  <button key={i.id} type="button" aria-label={`Icon ${i.id}`} onClick={() => setIconId(i.id)} className={cn("grid h-8 w-8 place-items-center rounded-md border", iconId === i.id ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-primary" : "border-[color:var(--color-border)] text-muted-foreground hover:text-foreground")}>
                    <i.icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`Fields · ${fields.length}`}>
              <div className="space-y-2.5">
                {fields.map((f, i) => (
                  <div key={i} className="rounded-lg border border-[color:var(--border-hairline)] bg-card p-2.5">
                    <div className="flex items-center gap-2">
                      <input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="Field label" className="h-8 flex-1 rounded-md border border-[color:var(--color-border)] bg-card px-2.5 text-[12.5px] outline-none focus:border-[color:var(--primary)]" />
                      <select value={f.type} onChange={(e) => setField(i, { type: e.target.value as CustomField["type"] })} aria-label="Field type" className="h-8 rounded-md border border-[color:var(--color-border)] bg-card px-1.5 text-[12px] text-foreground outline-none">
                        {FIELD_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                      <button type="button" aria-label="Remove field" onClick={() => setFields((arr) => arr.filter((_, j) => j !== i))} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {/* starter content per type */}
                    <div className="mt-2">
                      {f.type === "slot" ? (
                        <select value={defaults[f.key] ?? ""} onChange={(e) => setDefaults((d) => ({ ...d, [f.key]: e.target.value }))} aria-label="Slot component" className="h-8 w-full rounded-md border border-[color:var(--color-border)] bg-card px-1.5 text-[12px] text-foreground outline-none">
                          <option value="">Empty slot</option>
                          {targets.filter((t) => t.type !== preview.type).map((t) => (
                            <option key={t.type} value={t.type}>{t.name}</option>
                          ))}
                        </select>
                      ) : f.type === "image" ? (
                        <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                          <span className="h-6 w-9 rounded border border-[color:var(--color-border)] bg-gradient-to-br from-pink-100 via-white to-pink-50" />
                          Placeholder art now, the media library in the editor.
                        </div>
                      ) : f.type === "longtext" ? (
                        <textarea value={defaults[f.key] ?? ""} onChange={(e) => setDefaults((d) => ({ ...d, [f.key]: e.target.value }))} rows={2} placeholder="Starter content" className="w-full resize-none rounded-md border border-[color:var(--color-border)] bg-card px-2.5 py-1.5 text-[12px] outline-none focus:border-[color:var(--primary)]" />
                      ) : (
                        <input value={defaults[f.key] ?? ""} onChange={(e) => setDefaults((d) => ({ ...d, [f.key]: e.target.value }))} placeholder="Starter content" className="h-8 w-full rounded-md border border-[color:var(--color-border)] bg-card px-2.5 text-[12px] outline-none focus:border-[color:var(--primary)]" />
                      )}
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setFields((arr) => [...arr, { key: `field_${arr.length}`, label: "", type: "text" }])}>
                  <Plus className="mr-1 h-3 w-3" /> Add field
                </Button>
              </div>
            </Field>
            <Field label="Layouts">
              <label className="flex items-center gap-2 text-[12.5px] text-foreground">
                <input type="checkbox" checked={leftLayout} onChange={(e) => setLeftLayout(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                Include a left aligned layout
              </label>
            </Field>
          </div>
          {/* live preview pane */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[color:var(--s2)] p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Live preview</span>
              <div className="flex-1" />
              {preview.variants.map((v) => (
                <button key={v.id} type="button" onClick={() => setVariant(v.id)} className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium", variant === v.id ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-primary" : "border-[color:var(--color-border)] text-muted-foreground")}>
                  {v.name}
                </button>
              ))}
            </div>
            <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border border-[color:var(--color-border)] bg-white">
              <SectionPreviewTall component={preview} variant={variant} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Full-height live render (unlike the masked 36px gallery preview). */
function SectionPreviewTall({ component, variant }: { component: CustomComponent; variant: string }) {
  const def = toSectionDef(component);
  return (
    <div className="pointer-events-none select-none" aria-hidden>
      <div style={{ width: 1400, transform: "scale(0.62)", transformOrigin: "top left" }}>
        {def.render({ c: component.defaults, variant, editable: false, onEdit: () => {}, fid: () => undefined, label: () => undefined })}
      </div>
    </div>
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

/* -------------------------------------------------------------- AI studio */

function StudioOverlay({ projectId, workspaceId, onClose, onOpenComponent }: { projectId: string; workspaceId: string; onClose: () => void; onOpenComponent: (id: string) => void }) {
  const chats = useComponentChats(projectId);
  const customs = useCustomComponents(projectId);
  const brand = useBrandKit(projectId);
  const [chatId, setChatId] = useState<string | null>(chats[0]?.id ?? null);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [refs, setRefs] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [pop, setPop] = useState<"attach" | "skills" | "refs" | "brand" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const chat = chats.find((c) => c.id === chatId) ?? null;
  const draft = chat?.componentId ? customs.find((c) => c.id === chat.componentId) : undefined;
  const genCost = aiAction("section")?.costs.balanced ?? 30;
  const iterCost = aiAction("section")?.costs.lite ?? 15;
  const availableSkills = enabledInstructions(workspaceId, projectId).filter((i) => i.kind === "skill").map((i) => i.name);
  const targets = slotTargets(projectId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat?.messages.length, thinking]);

  const send = () => {
    const prompt = text.trim();
    if (prompt.length < 4 || thinking) return;
    let id = chatId;
    if (!id) id = componentChatActions.newChat(projectId, prompt).id;
    setChatId(id);
    componentChatActions.addMessage(projectId, id, {
      role: "user",
      text: prompt,
      attachments: attachments.length ? attachments : undefined,
      refs: refs.length ? refs : undefined,
      skills: skills.length ? skills : undefined,
    });
    setText("");
    setAttachments([]);
    setThinking(true);
    const isIteration = !!chat?.componentId;
    setTimeout(() => {
      if (!isIteration) {
        const input = buildComponentDraft({ prompt, refType: refs[0] });
        const c = componentHubActions.create(projectId, input);
        componentChatActions.addMessage(projectId, id!, {
          role: "assistant",
          text: `Drafted ${c.name}: ${c.blurb.toLowerCase()}. ${c.fields.length} fields, on-brand starter content${skills.length ? `, following ${skills.join(" and ")}` : ""}. It's in the library as a draft, review and publish when ready.`,
          credits: genCost,
          componentId: c.id,
        });
        recordAgentAudit(projectId, "agent.changes_applied", `AI studio drafted component ${c.name}`, id!);
      } else {
        const note = iterateComponent(projectId, chat!.componentId!, prompt);
        componentChatActions.addMessage(projectId, id!, { role: "assistant", text: note, credits: iterCost, componentId: chat!.componentId });
      }
      setThinking(false);
    }, 1100);
  };

  const spent = (c: { messages: { credits?: number }[] }) => c.messages.reduce((n, m) => n + (m.credits ?? 0), 0);

  return createPortal(
    <div className="fixed inset-0 z-[94] bg-[color:var(--s1)]">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] bg-card px-5 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[15px] font-semibold text-foreground">AI studio</span>
          <span className="hidden text-[12px] text-muted-foreground md:block">Draft a component, then keep talking until it's right. Drafts never publish themselves.</span>
          <div className="flex-1" />
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          {/* chats rail */}
          <div className="hidden w-60 shrink-0 flex-col border-r border-[color:var(--border-hairline)] bg-card md:flex">
            <div className="p-3">
              <Button size="sm" variant="outline" className="w-full" onClick={() => { setChatId(null); setRefs([]); setSkills([]); }}>
                <Plus className="mr-1 h-3.5 w-3.5" /> New chat
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {chats.length === 0 && <div className="px-2 py-6 text-center text-[11.5px] text-muted-foreground">Every generation is saved here, browse and pick any thread back up.</div>}
              {chats.map((c) => (
                <button key={c.id} type="button" onClick={() => setChatId(c.id)} className={cn("group mb-1 w-full rounded-lg px-2.5 py-2 text-left transition-colors", c.id === chatId ? "bg-[color:var(--primary)]/10" : "hover:bg-[color:var(--color-row-hover)]")}>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("min-w-0 flex-1 truncate text-[12.5px] font-medium", c.id === chatId ? "text-primary" : "text-foreground")}>{c.title}</span>
                    <span role="button" tabIndex={0} aria-label="Delete chat" onClick={(e) => { e.stopPropagation(); componentChatActions.remove(projectId, c.id); if (chatId === c.id) setChatId(null); }} className="hidden h-5 w-5 place-items-center rounded text-muted-foreground hover:text-destructive group-hover:grid">
                      <Trash2 className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">{c.messages.length} messages · {spent(c)} credits</div>
                </button>
              ))}
            </div>
          </div>

          {/* thread */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="mx-auto max-w-2xl space-y-4">
                {(!chat || chat.messages.length === 0) && (
                  <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-card px-5 py-8 text-center">
                    <Wand2 className="mx-auto h-6 w-6 text-primary" />
                    <div className="mt-2 text-[13.5px] font-semibold text-foreground">Describe the component you need</div>
                    <p className="mx-auto mt-1 max-w-md text-[12px] text-muted-foreground">
                      Attach references, tag an existing component with @, or apply a workspace skill. First draft costs about {genCost} credits, each refinement about {iterCost}.
                    </p>
                  </div>
                )}
                {chat?.messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed", m.role === "user" ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border-hairline)] bg-card text-foreground")}>
                      {m.text}
                      {(m.attachments?.length || m.refs?.length || m.skills?.length) ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.attachments?.map((a) => (
                            <span key={a.name} className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-medium", m.role === "user" ? "bg-white/20" : "bg-[color:var(--s2)] text-muted-foreground")}>📎 {a.name}</span>
                          ))}
                          {m.refs?.map((r) => (
                            <span key={r} className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-medium", m.role === "user" ? "bg-white/20" : "bg-[color:var(--s2)] text-muted-foreground")}>@{targets.find((t) => t.type === r)?.name ?? r}</span>
                          ))}
                          {m.skills?.map((s) => (
                            <span key={s} className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-medium", m.role === "user" ? "bg-white/20" : "bg-[color:var(--s2)] text-muted-foreground")}>Skill: {s}</span>
                          ))}
                        </div>
                      ) : null}
                      {m.role === "assistant" && m.componentId && draft && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-[color:var(--color-border)]">
                          <SectionPreview def={toSectionDef(draft)} variant={draft.variants[0]?.id ?? "centered"} />
                          <div className="flex items-center justify-between border-t border-[color:var(--border-hairline)] bg-[color:var(--s1)] px-2.5 py-1.5">
                            <span className="text-[11px] font-medium text-foreground">{draft.name} <Badge tone={draft.status}>{draft.status === "published" ? "Published" : "Draft"}</Badge></span>
                            <button type="button" onClick={() => onOpenComponent(draft.id)} className="text-[11px] font-semibold text-primary hover:underline">Open in library</button>
                          </div>
                        </div>
                      )}
                      {m.credits ? <div className={cn("mt-1.5 text-[10.5px]", m.role === "user" ? "text-white/70" : "text-muted-foreground")}>{m.credits} credits</div> : null}
                    </div>
                  </div>
                ))}
                {thinking && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--border-hairline)] bg-card px-4 py-2.5 text-[12.5px] text-muted-foreground">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--primary)]/25 border-t-[color:var(--primary)]" />
                      {chat?.componentId ? "Refining the draft" : "Reading the brand kit and drafting"}
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            {/* composer */}
            <div className="border-t border-[color:var(--border-hairline)] bg-card px-5 py-3.5">
              <div className="mx-auto max-w-2xl">
                {/* brand row */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Brand</span>
                  {[brand.colors.primary, brand.colors.accent, brand.colors.surface].map((c) => (
                    <span key={c} className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: c }} title={c} />
                  ))}
                  <span className="text-[11px] text-muted-foreground">{brand.typography.headingFont}</span>
                  <button type="button" onClick={() => setPop(pop === "brand" ? null : "brand")} className="text-[11px] font-semibold text-primary hover:underline">Edit brand</button>
                  {pop === "brand" && (
                    <div className="flex items-center gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--s1)] px-2 py-1">
                      {(["primary", "accent", "surface"] as const).map((k) => (
                        <label key={k} className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                          {k}
                          <input type="color" value={brand.colors[k]} onChange={(e) => brandActions.update(projectId, { colors: { ...brand.colors, [k]: e.target.value } })} aria-label={`Brand ${k} color`} className="h-5 w-7 cursor-pointer border-0 bg-transparent p-0" />
                        </label>
                      ))}
                      <span className="text-[10px] text-muted-foreground">Previews update live</span>
                    </div>
                  )}
                </div>
                {/* chips */}
                {(attachments.length > 0 || refs.length > 0 || skills.length > 0) && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {attachments.map((a) => (
                      <Chip key={a.name} onX={() => setAttachments((arr) => arr.filter((x) => x.name !== a.name))}>📎 {a.name}</Chip>
                    ))}
                    {refs.map((r) => (
                      <Chip key={r} onX={() => setRefs((arr) => arr.filter((x) => x !== r))}>@{targets.find((t) => t.type === r)?.name ?? r}</Chip>
                    ))}
                    {skills.map((s) => (
                      <Chip key={s} onX={() => setSkills((arr) => arr.filter((x) => x !== s))}>Skill: {s}</Chip>
                    ))}
                  </div>
                )}
                <div className="relative rounded-xl border border-[color:var(--color-border)] bg-[color:var(--s1)] focus-within:border-[color:var(--primary)]">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    rows={2}
                    placeholder={chat?.componentId ? "Refine it: add an image, make it punchier, rename it…" : "A stats band with three numbers and a bold heading…"}
                    className="w-full resize-none bg-transparent px-3.5 pb-9 pt-2.5 text-[13px] text-foreground outline-none"
                  />
                  <div className="absolute bottom-2 left-2.5 flex items-center gap-1">
                    <ComposerBtn label="Attach a file" onClick={() => setPop(pop === "attach" ? null : "attach")}><Paperclip className="h-3.5 w-3.5" /></ComposerBtn>
                    <ComposerBtn label="Reference a component" onClick={() => setPop(pop === "refs" ? null : "refs")}><AtSign className="h-3.5 w-3.5" /></ComposerBtn>
                    <ComposerBtn label="Apply a skill" onClick={() => setPop(pop === "skills" ? null : "skills")}><Wand2 className="h-3.5 w-3.5" /></ComposerBtn>
                  </div>
                  <div className="absolute bottom-2 right-2.5 flex items-center gap-2">
                    <span className="text-[10.5px] text-muted-foreground">{chat?.componentId ? `~${iterCost}` : `~${genCost}`} credits</span>
                    <button type="button" onClick={send} disabled={text.trim().length < 4 || thinking} aria-label="Send" className={cn("grid h-7 w-7 place-items-center rounded-lg", text.trim().length >= 4 && !thinking ? "bg-[color:var(--primary)] text-white" : "bg-[color:var(--s2)] text-muted-foreground")}>
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {pop === "attach" && (
                    <Pop title="Attach">
                      {(["image", "video", "file"] as const).map((k) => (
                        <PopRow key={k} onClick={() => { setAttachments((a) => [...a, { kind: k, name: k === "image" ? `reference-${a.length + 1}.png` : k === "video" ? "walkthrough.mp4" : "brand-notes.md" }]); setPop(null); }}>
                          {k === "image" ? "Image or screenshot" : k === "video" ? "Video" : "Markdown or doc"}
                        </PopRow>
                      ))}
                    </Pop>
                  )}
                  {pop === "refs" && (
                    <Pop title="Reference a component">
                      {targets.slice(0, 12).map((t) => (
                        <PopRow key={t.type} onClick={() => { setRefs((r) => (r.includes(t.type) ? r : [...r, t.type])); setPop(null); }}>{t.name}</PopRow>
                      ))}
                    </Pop>
                  )}
                  {pop === "skills" && (
                    <Pop title="Workspace skills">
                      {availableSkills.length === 0 && <div className="px-3 py-2 text-[11.5px] text-muted-foreground">No skills yet. Create them under Instructions.</div>}
                      {availableSkills.map((s) => (
                        <PopRow key={s} onClick={() => { setSkills((x) => (x.includes(s) ? x : [...x, s])); setPop(null); }}>{s}</PopRow>
                      ))}
                    </Pop>
                  )}
                </div>
                <div className="mt-1.5 text-[10.5px] text-muted-foreground">Every turn is logged here and in the audit trail. Drafts land in the library, publishing stays with you.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Chip({ children, onX }: { children: React.ReactNode; onX: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--color-border)] bg-card px-1.5 py-0.5 text-[11px] font-medium text-foreground">
      {children}
      <button type="button" onClick={onX} aria-label="Remove" className="text-muted-foreground hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function ComposerBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
      {children}
    </button>
  );
}

function Pop({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="absolute bottom-11 left-2 z-10 w-60 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-card shadow-xl">
      <div className="border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="max-h-52 overflow-y-auto p-1">{children}</div>
    </div>
  );
}

function PopRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-foreground hover:bg-[color:var(--color-row-hover)]">
      {children}
    </button>
  );
}
