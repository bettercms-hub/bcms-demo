/**
 * Instructions — the workspace library of agent skills and rules.
 *
 * Skills teach agents how to do specific tasks; rules are boundaries agents
 * always respect. The library is shared across the workspace (author once,
 * every project follows it) with a per-project opt-out on each instruction.
 *
 * Layout: left rail (skills + rules, per-kind create menus) and a main pane
 * that is either the template gallery (nothing selected) or the editor —
 * settings column plus a markdown editor whose "Insert reference" menu drops
 * live CMS entities (collections, fields, components, pages, brand tokens)
 * into the text as chips. See INSTRUCTIONS_PLAN.md for the decisions.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  AtSign,
  BookOpen,
  Bold,
  Boxes,
  ChevronRight,
  Code,
  CopyPlus,
  Database,
  Download,
  FileText,
  FileUp,
  Film,
  Heading2,
  Image as ImageIcon,
  Italic,
  LayoutTemplate,
  List,
  Palette,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { canCompose, useEffectiveRole } from "@/lib/workspace/my-role";
import { getPages } from "@/lib/cms/pages-store";
import { useModels } from "@/lib/cms/schema-store";
import { useCMS } from "@/lib/cms/store";
import type { MediaAsset } from "@/lib/cms/types";
import { COMPONENT_CATALOG } from "@/lib/cms/blocks/rich-blocks";
import { SECTION_DEFS } from "@/components/cms/editor/sections/SectionSystem";
import {
  INSTRUCTION_TEMPLATES,
  instructionActions,
  refToken,
  splitRefTokens,
  useInstructions,
  type Instruction,
  type InstructionKind,
  type ReferenceType,
} from "@/lib/agent/instructions-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/w/$workspace/p/$project/instructions")({
  component: InstructionsPage,
});

const KIND_META: Record<InstructionKind, { label: string; plural: string; blurb: string; icon: typeof BookOpen }> = {
  skill: { label: "Skill", plural: "Skills", blurb: "Skills teach the agent how to do specific tasks.", icon: BookOpen },
  rule: { label: "Rule", plural: "Rules", blurb: "Rules are boundaries the agent always respects.", icon: Shield },
};

/** Chip tint per reference type, shared by the preview and the insert menu. */
const REF_TINT: Record<string, string> = {
  Asset: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20",
  Collection: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
  Field: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
  Component: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  Section: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20",
  Page: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  "Brand token": "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] text-[var(--primary)] border-[color-mix(in_srgb,var(--primary)_25%,transparent)]",
  Skill: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20",
  Rule: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20",
};

/** Icon per reference category, shown on the drill-down rows. */
const REF_ICON: Record<string, LucideIcon> = {
  Asset: ImageIcon,
  Collection: Database,
  Field: Type,
  Component: Boxes,
  Section: LayoutTemplate,
  Page: FileText,
  "Brand token": Palette,
  Skill: BookOpen,
  Rule: Shield,
};

function InstructionsPage() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project);
  const { effective } = useEffectiveRole(workspace);
  const canAuthor = canCompose(effective);
  const wsId = pr?.workspaceId ?? "";
  const instructions = useInstructions(wsId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const importKindRef = useRef<InstructionKind>("skill");

  if (!pr) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-[13px] text-muted-foreground">
        Project not found. Pick a project from the dashboard.
      </div>
    );
  }

  const selected = instructions.find((i) => i.id === selectedId) ?? null;
  const skills = instructions.filter((i) => i.kind === "skill");
  const rules = instructions.filter((i) => i.kind === "rule");

  function createBlank(kind: InstructionKind) {
    const ins = instructionActions.create(wsId, { kind, name: `Untitled ${kind}` });
    setSelectedId(ins.id);
  }
  function createFromTemplate(templateId: string) {
    const ins = instructionActions.createFromTemplate(wsId, templateId);
    if (ins) {
      setSelectedId(ins.id);
      toast.success(`"${ins.name}" added to the library`);
    }
  }
  function startImport(kind: InstructionKind) {
    importKindRef.current = kind;
    importRef.current?.click();
  }
  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const body = String(reader.result ?? "");
      const name = file.name.replace(/\.(md|markdown|txt)$/i, "").replace(/[-_]+/g, " ").trim() || "Imported instruction";
      const ins = instructionActions.create(wsId, {
        kind: importKindRef.current,
        name: name[0].toUpperCase() + name.slice(1),
        body,
        source: "import",
      });
      setSelectedId(ins.id);
      toast.success(`Imported "${ins.name}"`);
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex min-h-0 flex-1">
      <input ref={importRef} type="file" accept=".md,.markdown,.txt" className="hidden" onChange={onImportFile} aria-hidden />

      {/* ---------------------------------------------------------- rail */}
      <aside className="flex w-[248px] shrink-0 flex-col border-r border-border bg-background">
        <div className="border-b border-[color:var(--border-hairline)] px-3 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Instructions</span>
            <Link
              to="/w/$workspace/p/$project/agent"
              params={{ workspace, project }}
              className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Agent
            </Link>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Shared across the workspace. Every project and teammate works from the same playbook.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {(["skill", "rule"] as const).map((kind) => {
            const meta = KIND_META[kind];
            const list = kind === "skill" ? skills : rules;
            return (
              <div key={kind} className="mb-3">
                <div className="flex items-center justify-between px-1.5 py-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {meta.plural} · {list.length}
                  </span>
                  {canAuthor && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`New ${kind}`}
                          className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[190px]">
                        <DropdownMenuItem className="text-[12.5px]" onSelect={() => setSelectedId(null)}>
                          <Sparkles className="mr-2 h-3.5 w-3.5" /> Create from template
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[12.5px]" onSelect={() => createBlank(kind)}>
                          <FileText className="mr-2 h-3.5 w-3.5" /> Create manually
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-[12.5px]" onSelect={() => startImport(kind)}>
                          <FileUp className="mr-2 h-3.5 w-3.5" /> Import .md
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {list.length === 0 ? (
                  <div className="mx-0.5 rounded-lg bg-[color:var(--s2)]/60 px-3 py-3.5 text-center">
                    <p className="text-[11.5px] font-medium text-foreground">No {meta.plural.toLowerCase()} yet</p>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{meta.blurb}</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {list.map((ins) => {
                      const offHere = ins.disabledFor.includes(pr.id);
                      const active = selectedId === ins.id;
                      return (
                        <button
                          key={ins.id}
                          type="button"
                          onClick={() => setSelectedId(ins.id)}
                          aria-current={active}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                            active ? "bg-[color:color-mix(in_oklab,var(--primary)_9%,transparent)]" : "hover:bg-[color:var(--color-row-hover)]",
                          )}
                        >
                          <meta.icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", active ? "font-medium text-foreground" : "text-foreground/90")}>
                            {ins.name}
                          </span>
                          <span
                            title={!ins.enabled ? "Off everywhere" : offHere ? "Off for this project" : "On"}
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              !ins.enabled ? "bg-[color:var(--s3)]" : offHere ? "bg-amber-400" : "bg-emerald-500",
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ---------------------------------------------------------- main */}
      {selected ? (
        <InstructionEditor
          key={selected.id}
          ins={selected}
          wsId={wsId}
          projectId={pr.id}
          canAuthor={canAuthor}
          library={instructions}
          onClose={() => setSelectedId(null)}
          onDeleted={() => setSelectedId(null)}
        />
      ) : (
        <TemplateGallery canAuthor={canAuthor} onPick={createFromTemplate} onBlank={createBlank} onImport={startImport} />
      )}
    </div>
  );
}

/* -------------------------------------------------------- template gallery */

function TemplateGallery({
  canAuthor,
  onPick,
  onBlank,
  onImport,
}: {
  canAuthor: boolean;
  onPick: (templateId: string) => void;
  onBlank: (kind: InstructionKind) => void;
  onImport: (kind: InstructionKind) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[820px] px-8 py-10">
        <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-foreground">Create a skill or rule</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Teach agents how your team works. Instructions are shared across the workspace, so author them once and every
          project follows them.
        </p>

        {(["skill", "rule"] as const).map((kind) => {
          const meta = KIND_META[kind];
          const templates = INSTRUCTION_TEMPLATES.filter((t) => t.kind === kind);
          return (
            <div key={kind} className="mt-8">
              <h2 className="text-[14px] font-semibold text-foreground">{meta.plural}</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{meta.blurb}</p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  type="button"
                  disabled={!canAuthor}
                  onClick={() => onBlank(kind)}
                  className="flex flex-col items-start rounded-xl border border-dashed border-[color:var(--color-border)] px-3.5 py-3 text-left transition-colors hover:border-[color:var(--primary)] hover:bg-[color:var(--color-row-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" /> Blank {kind}
                  </span>
                  <span className="mt-1 text-[11.5px] leading-snug text-muted-foreground">Start from scratch.</span>
                </button>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!canAuthor}
                    onClick={() => onPick(t.id)}
                    className="flex flex-col items-start rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] px-3.5 py-3 text-left shadow-[var(--shadow-card)] transition-colors hover:border-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="text-[13px] font-medium text-foreground">{t.name}</span>
                    <span className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">{t.blurb}</span>
                  </button>
                ))}
              </div>
              {canAuthor && (
                <button
                  type="button"
                  onClick={() => onImport(kind)}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary transition-opacity hover:opacity-80"
                >
                  <FileUp className="h-3.5 w-3.5" /> Import a {kind} from a .md file
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ editor */

function InstructionEditor({
  ins,
  wsId,
  projectId,
  canAuthor,
  library,
  onClose,
  onDeleted,
}: {
  ins: Instruction;
  wsId: string;
  projectId: string;
  canAuthor: boolean;
  library: Instruction[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const meta = KIND_META[ins.kind];
  // The rich "Text" view is a Notion-style editable render (first); "Markdown"
  // is the raw source (second). Both edit the same body — see the blog editor.
  const [view, setView] = useState<"text" | "markdown">("text");
  const [refOpen, setRefOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const richRef = useRef<HTMLDivElement>(null);
  // The caret in the rich editor at the moment the reference menu opened, so an
  // inserted chip lands where the writer was, not at the document start.
  const savedRange = useRef<Range | null>(null);
  const set = (patch: Partial<Instruction>) => instructionActions.update(wsId, ins.id, patch);
  const offHere = ins.disabledFor.includes(projectId);

  // Seed the contentEditable from markdown when entering the rich view or when
  // the instruction changes — never on every keystroke, so the caret is kept.
  useEffect(() => {
    if (view === "text" && richRef.current) richRef.current.innerHTML = mdToHtml(ins.body) || "<p><br></p>";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, ins.id]);

  /** Serialize the rich editor's DOM back to markdown. */
  function serializeRich() {
    if (richRef.current) set({ body: htmlToMd(richRef.current) });
  }
  /** Run an execCommand on the focused rich editor, then persist. */
  function richCmd(command: string, value?: string) {
    richRef.current?.focus();
    document.execCommand(command, false, value);
    serializeRich();
  }

  /** Insert text at the caret in the markdown textarea, keeping focus. */
  function insertAtCursor(text: string) {
    const el = bodyRef.current;
    if (!el) {
      set({ body: `${ins.body}${text}` });
      return;
    }
    const start = el.selectionStart ?? ins.body.length;
    const end = el.selectionEnd ?? start;
    const next = ins.body.slice(0, start) + text + ins.body.slice(end);
    set({ body: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  /** Wrap the selection (or insert a placeholder) with markdown markers. */
  function wrapSelection(marker: string, placeholder: string) {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const picked = ins.body.slice(start, end) || placeholder;
    const next = ins.body.slice(0, start) + marker + picked + marker + ins.body.slice(end);
    set({ body: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + marker.length, start + marker.length + picked.length);
    });
  }

  /** Toolbar actions dispatch to whichever editor is active. */
  const doHeading = () => (view === "markdown" ? insertAtCursor("\n## ") : richCmd("formatBlock", "H2"));
  const doBold = () => (view === "markdown" ? wrapSelection("**", "bold text") : richCmd("bold"));
  const doItalic = () => (view === "markdown" ? wrapSelection("*", "italic text") : richCmd("italic"));
  const doList = () => (view === "markdown" ? insertAtCursor("\n- ") : richCmd("insertUnorderedList"));
  /** Open the reference menu, remembering the rich caret first. */
  function openReferenceMenu() {
    if (view === "text") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && richRef.current?.contains(sel.anchorNode)) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
      }
    }
    setRefOpen((v) => !v);
  }
  function insertReference(type: ReferenceType, label: string) {
    if (view === "markdown") insertAtCursor(refToken(type, label));
    else {
      richRef.current?.focus();
      // Put the caret back where the writer was before the menu took focus.
      const r = savedRange.current;
      if (r) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
      document.execCommand("insertHTML", false, `${chipHtml(type, label)}&nbsp;`);
      serializeRich();
    }
    setRefOpen(false);
  }

  function exportMd() {
    const blob = new Blob([ins.body], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ins.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "instruction"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as Markdown");
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* settings column */}
      <div className="flex w-[264px] shrink-0 flex-col overflow-y-auto border-r border-[color:var(--border-hairline)] bg-[color:var(--s2)]/40 px-4 py-4">
        <button
          type="button"
          onClick={onClose}
          className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All instructions
        </button>

        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-foreground">Name</span>
          <input
            value={ins.name}
            disabled={!canAuthor}
            onChange={(e) => set({ name: e.target.value })}
            className="h-8 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[12.5px] text-foreground outline-none transition-colors focus:border-[color:var(--primary)] disabled:opacity-60"
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-[11.5px] font-medium text-foreground">Description</span>
          <textarea
            value={ins.description}
            disabled={!canAuthor}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
            placeholder="What this instruction is for"
            className="w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 py-2 text-[12px] leading-snug text-foreground outline-none transition-colors focus:border-[color:var(--primary)] disabled:opacity-60"
          />
        </label>

        <div className="mt-4 overflow-hidden rounded-lg border border-[color:var(--color-border)]">
          <SettingToggle
            label={ins.enabled ? "On" : "Off"}
            hint="Agents follow this instruction on every run."
            on={ins.enabled}
            disabled={!canAuthor}
            onToggle={() => set({ enabled: !ins.enabled })}
          />
          <div className="border-t border-[color:var(--border-hairline)]">
            <SettingToggle
              label="Applies to this project"
              hint="Turn off to exclude just this project."
              on={!offHere}
              disabled={!canAuthor || !ins.enabled}
              onToggle={() => instructionActions.toggleProject(wsId, ins.id, projectId)}
            />
          </div>
        </div>

        <div className="mt-4 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground/80">Created</p>
          <p className="mt-0.5">{new Date(ins.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>

        <div className="mt-auto space-y-1 pt-6">
          <SettingsAction icon={Download} label="Export as .md" onClick={exportMd} />
          {canAuthor && (
            <>
              <SettingsAction
                icon={CopyPlus}
                label="Duplicate"
                onClick={() => {
                  const copy = instructionActions.duplicate(wsId, ins.id);
                  if (copy) toast.success(`"${copy.name}" created`);
                }}
              />
              {confirmDelete ? (
                <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5">
                  <span className="flex-1 text-[11.5px] font-medium text-destructive">Delete this {ins.kind}?</span>
                  <button
                    type="button"
                    onClick={() => {
                      instructionActions.remove(wsId, ins.id);
                      onDeleted();
                      toast.success(`"${ins.name}" deleted`);
                    }}
                    className="rounded bg-destructive px-1.5 py-0.5 text-[11px] font-semibold text-white hover:bg-[color-mix(in_srgb,var(--destructive)_88%,#000)]"
                  >
                    Delete
                  </button>
                  <button type="button" aria-label="Cancel" onClick={() => setConfirmDelete(false)} className="grid h-5 w-5 place-items-center rounded text-destructive hover:bg-destructive/10">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <SettingsAction icon={Trash2} label={`Delete ${ins.kind}`} danger onClick={() => setConfirmDelete(true)} />
              )}
            </>
          )}
        </div>
      </div>

      {/* editor column */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-[color:var(--border-hairline)] px-4 py-2">
          <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] px-2 py-0.5 text-[11px] font-medium text-primary">
            <meta.icon className="h-3 w-3" /> {meta.label}
          </span>

          {canAuthor && (
            <div className="ml-2 flex items-center gap-0.5">
              <EditorBtn label="Heading" onClick={doHeading}>
                <Heading2 className="h-3.5 w-3.5" />
              </EditorBtn>
              <EditorBtn label="Bold" onClick={doBold}>
                <Bold className="h-3.5 w-3.5" />
              </EditorBtn>
              <EditorBtn label="Italic" onClick={doItalic}>
                <Italic className="h-3.5 w-3.5" />
              </EditorBtn>
              <EditorBtn label="List item" onClick={doList}>
                <List className="h-3.5 w-3.5" />
              </EditorBtn>
              <div className="relative">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openReferenceMenu}
                  aria-expanded={refOpen}
                  className={cn(
                    "ml-1 inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11.5px] font-medium transition-colors",
                    refOpen
                      ? "border-[color:var(--primary)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary"
                      : "border-[color:var(--color-border)] text-foreground/85 hover:bg-[color:var(--color-row-hover)]",
                  )}
                >
                  <AtSign className="h-3 w-3" /> Insert reference
                </button>
                {refOpen && (
                  <ReferenceMenu
                    projectId={projectId}
                    library={library}
                    selfId={ins.id}
                    onClose={() => setRefOpen(false)}
                    onInsert={insertReference}
                  />
                )}
              </div>
            </div>
          )}

          {/* Text (Notion-style, editable) comes first; Markdown second. */}
          <div className="ml-auto flex items-center rounded-md border border-[color:var(--color-border)] p-0.5">
            {(
              [
                { id: "text" as const, icon: Type, label: "Text" },
                { id: "markdown" as const, icon: Code, label: "Markdown" },
              ]
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={view === v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded px-2 text-[11.5px] font-medium transition-colors",
                  view === v.id ? "bg-[color:var(--s2)] text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <v.icon className="h-3 w-3" /> {v.label}
              </button>
            ))}
          </div>
        </div>

        {view === "text" ? (
          <div
            ref={richRef}
            contentEditable={canAuthor}
            suppressContentEditableWarning
            onInput={serializeRich}
            role="textbox"
            aria-multiline="true"
            aria-label={`${ins.name} body`}
            className={cn(
              "prose-ins min-h-0 flex-1 overflow-y-auto px-6 py-5 text-[13px] leading-relaxed text-foreground/90 outline-none",
              "[&_h1]:mb-2 [&_h1]:text-[21px] [&_h1]:font-bold [&_h1]:tracking-[-0.01em] [&_h1]:text-foreground",
              "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:text-foreground",
              "[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:text-foreground",
              "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
              "[&_p]:my-1.5 [&_strong]:font-semibold",
              "[&_code]:rounded [&_code]:bg-[color:var(--s2)] [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.9em]",
            )}
          />
        ) : (
          <textarea
            ref={bodyRef}
            value={ins.body}
            disabled={!canAuthor}
            onChange={(e) => set({ body: e.target.value })}
            spellCheck={false}
            aria-label={`${ins.name} Markdown`}
            className="min-h-0 flex-1 resize-none bg-transparent px-6 py-5 font-mono text-[12.5px] leading-[1.7] text-foreground outline-none disabled:opacity-70"
          />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- small pieces */

function SettingToggle({ label, hint, on, disabled, onToggle }: { label: string; hint: string; on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[color:var(--card)] px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          on ? "bg-primary" : "bg-[color:var(--s3)]",
        )}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all", on ? "left-[18px]" : "left-0.5")} />
      </button>
    </div>
  );
}

function SettingsAction({ icon: Icon, label, danger, onClick }: { icon: typeof Download; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium transition-colors",
        danger ? "text-destructive hover:bg-destructive/10" : "text-foreground/85 hover:bg-[color:var(--color-row-hover)]",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function EditorBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------- reference menu */

interface RefItem {
  label: string;
  /** Media only: thumbnail + media kind for the picker rows. */
  thumb?: string;
  mediaKind?: MediaAsset["kind"];
}
interface RefGroup {
  type: ReferenceType;
  items: RefItem[];
}

/**
 * A nested, Webflow-style insert menu: the root is a short list of categories
 * (Assets, Collections, Fields, Components…) so it never becomes one long
 * scroll; each drills into a searchable list. Typing at the root searches
 * across everything. Assets are picked from the media library with thumbnails.
 */
function ReferenceMenu({
  projectId,
  library,
  selfId,
  onInsert,
  onClose,
}: {
  projectId: string;
  library: Instruction[];
  selfId: string;
  onInsert: (type: ReferenceType, label: string) => void;
  onClose: () => void;
}) {
  const [drill, setDrill] = useState<ReferenceType | null>(null);
  const [q, setQ] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"all" | MediaAsset["kind"]>("all");
  const models = useModels(projectId);
  const allMedia = useCMS((s) => s.media);

  const groups = useMemo<RefGroup[]>(() => {
    const assets: RefItem[] = allMedia
      .filter((m) => m.projectId === projectId)
      .map((m) => ({ label: m.name, thumb: m.thumbUrl || m.url, mediaKind: m.kind }));
    const str = (labels: string[]): RefItem[] => labels.map((label) => ({ label }));
    const list: RefGroup[] = [
      { type: "Asset", items: assets },
      { type: "Collection", items: str(models.filter((m) => m.kind === "collection").map((m) => m.name)) },
      { type: "Field", items: str(models.flatMap((m) => m.fields.map((f) => `${m.name} / ${f.label}`))) },
      { type: "Component", items: str(COMPONENT_CATALOG.map((c) => c.label)) },
      { type: "Section", items: str(SECTION_DEFS.map((s) => s.name)) },
      { type: "Page", items: str(getPages(projectId).map((p) => p.title)) },
      { type: "Brand token", items: str(["Voice / tone", "Preferred words", "Words to avoid", "Protected phrases", "Colors / primary", "Typography / heading font", "Logos / primary"]) },
      { type: "Skill", items: str(library.filter((i) => i.kind === "skill" && i.id !== selfId).map((i) => i.name)) },
      { type: "Rule", items: str(library.filter((i) => i.kind === "rule" && i.id !== selfId).map((i) => i.name)) },
    ];
    return list.filter((g) => g.items.length > 0);
  }, [allMedia, projectId, models, library, selfId]);

  const query = q.trim().toLowerCase();
  const activeGroup = drill ? groups.find((g) => g.type === drill) : null;

  // Root while searching: flat matches across every category.
  const searchHits = useMemo(() => {
    if (!query || drill) return [];
    return groups
      .map((g) => ({ type: g.type, items: g.items.filter((i) => i.label.toLowerCase().includes(query)).slice(0, 5) }))
      .filter((g) => g.items.length > 0);
  }, [groups, query, drill]);

  // Drill list: this category's items, filtered by search (and media kind).
  const drillItems = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.items.filter(
      (i) =>
        (!query || i.label.toLowerCase().includes(query)) &&
        (activeGroup.type !== "Asset" || mediaFilter === "all" || i.mediaKind === mediaFilter),
    );
  }, [activeGroup, query, mediaFilter]);

  function pick(type: ReferenceType, label: string) {
    onInsert(type, label);
  }
  function enter(type: ReferenceType) {
    setDrill(type);
    setQ("");
    setMediaFilter("all");
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Insert reference"
        onMouseDown={(e) => {
          // Keep the editor's caret; let the search input take focus normally.
          if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
        }}
        className="absolute left-0 top-[calc(100%+6px)] z-50 w-[304px] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-[var(--shadow-3)]"
      >
        {/* header: back (in drill) + search */}
        <div className="flex items-center gap-1 border-b border-[color:var(--border-hairline)] px-1.5">
          {drill ? (
            <button
              type="button"
              onClick={() => {
                setDrill(null);
                setQ("");
              }}
              aria-label="Back"
              className="grid h-8 w-7 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Search className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") drill ? setDrill(null) : onClose();
            }}
            placeholder={drill ? `Search ${drill.toLowerCase()}s…` : "Search everything…"}
            aria-label="Search references"
            className="h-9 w-full bg-transparent pr-2 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* media kind filter, only in the Asset drill */}
        {drill === "Asset" && (
          <div className="flex items-center gap-1 border-b border-[color:var(--border-hairline)] px-2 py-1.5">
            {(["all", "image", "video", "file"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setMediaFilter(k)}
                className={cn(
                  "rounded-[6px] px-2 py-0.5 text-[11px] font-medium capitalize transition-colors",
                  mediaFilter === k ? "bg-[color:var(--primary)] text-white" : "text-muted-foreground hover:bg-[color:var(--color-row-hover)]",
                )}
              >
                {k === "all" ? "All" : `${k}s`}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {/* ROOT — category rows */}
          {!drill && !query && (
            <>
              {groups.map((g) => {
                const Icon = REF_ICON[g.type] ?? FileText;
                return (
                  <button
                    key={g.type}
                    type="button"
                    onClick={() => enter(g.type)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--color-row-hover)]"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
                      {g.type === "Asset" ? "Assets" : g.type === "Brand token" ? "Brand tokens" : `${g.type}s`}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">{g.items.length}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  </button>
                );
              })}
            </>
          )}

          {/* ROOT — global search results */}
          {!drill && query && (
            <>
              {searchHits.length === 0 && <p className="px-2 py-3 text-center text-[12px] text-muted-foreground">Nothing matches.</p>}
              {searchHits.map((g) => (
                <div key={g.type} className="mb-1.5">
                  <div className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.type}s</div>
                  {g.items.map((it) => (
                    <RefRow key={it.label} type={g.type} item={it} onPick={() => pick(g.type, it.label)} />
                  ))}
                </div>
              ))}
            </>
          )}

          {/* DRILL — one category */}
          {drill && (
            <>
              {drillItems.length === 0 && <p className="px-2 py-3 text-center text-[12px] text-muted-foreground">Nothing here.</p>}
              {drillItems.map((it) => (
                <RefRow key={it.label} type={drill} item={it} onPick={() => pick(drill, it.label)} />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** One selectable reference row — a media thumbnail for assets, a type badge
 *  for everything else. */
function RefRow({ type, item, onPick }: { type: ReferenceType; item: RefItem; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[color:var(--color-row-hover)]"
    >
      {type === "Asset" ? (
        <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded bg-[color:var(--s2)] text-muted-foreground">
          {item.mediaKind === "image" && item.thumb ? (
            <img src={item.thumb} alt="" className="h-full w-full object-cover" />
          ) : item.mediaKind === "video" ? (
            <Film className="h-3 w-3" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
        </span>
      ) : (
        <span className={cn("shrink-0 rounded border px-1 py-px text-[9.5px] font-semibold", REF_TINT[type])}>{type}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{item.label}</span>
    </button>
  );
}

/* -------------------------------------------------- markdown <-> rich HTML */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Base classes for a reference chip in the rich editor (kept in-source so
 *  Tailwind generates them). Tint is appended per type. */
const CHIP_BASE =
  "ins-chip mx-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-px align-baseline text-[11px] font-medium";

/** A reference chip as an atomic, non-editable inline node. */
function chipHtml(type: string, label: string): string {
  const tint = REF_TINT[type] ?? "border-border bg-muted/40 text-foreground/80";
  return `<span class="${CHIP_BASE} ${tint}" contenteditable="false" data-ref-type="${escapeAttr(type)}" data-ref-label="${escapeAttr(label)}">${escapeHtml(label)}</span>`;
}

/** Inline markdown (chips + **bold** + `code`) to HTML. */
function inlineMdToHtml(text: string): string {
  return splitRefTokens(text)
    .map((p) => {
      if (p.kind === "ref") return chipHtml(p.refType ?? "", p.label ?? "");
      return escapeHtml(p.value)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
    })
    .join("");
}

/** Markdown to the HTML the contentEditable renders. */
function mdToHtml(md: string): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (const raw of md.split("\n")) {
    const t = raw.trim();
    if (!t) {
      closeList();
      continue;
    }
    if (t.startsWith("### ")) {
      closeList();
      out.push(`<h3>${inlineMdToHtml(t.slice(4))}</h3>`);
      continue;
    }
    if (t.startsWith("## ")) {
      closeList();
      out.push(`<h2>${inlineMdToHtml(t.slice(3))}</h2>`);
      continue;
    }
    if (t.startsWith("# ")) {
      closeList();
      out.push(`<h1>${inlineMdToHtml(t.slice(2))}</h1>`);
      continue;
    }
    const num = t.match(/^\d+\.\s+(.*)$/);
    if (num) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inlineMdToHtml(num[1])}</li>`);
      continue;
    }
    if (t.startsWith("- ")) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inlineMdToHtml(t.slice(2))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inlineMdToHtml(t)}</p>`);
  }
  closeList();
  return out.join("");
}

/** Inline DOM to markdown (chips -> tokens, strong -> **, code -> `). */
function inlineDomToMd(node: Node): string {
  let out = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.textContent ?? "";
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    if (el.classList.contains("ins-chip")) {
      out += `@[${el.dataset.refType ?? ""}: ${el.dataset.refLabel ?? el.textContent ?? ""}]`;
      return;
    }
    const tag = el.tagName;
    if (tag === "STRONG" || tag === "B") out += `**${inlineDomToMd(el)}**`;
    else if (tag === "EM" || tag === "I") out += `*${inlineDomToMd(el)}*`;
    else if (tag === "CODE") out += "`" + inlineDomToMd(el) + "`";
    else if (tag === "BR") out += "\n";
    else out += inlineDomToMd(el);
  });
  return out;
}

/** The rich editor's DOM back to markdown. */
function htmlToMd(root: HTMLElement): string {
  const blocks: string[] = [];
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? "").trim();
      if (t) blocks.push(t);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    switch (el.tagName) {
      case "H1":
        blocks.push(`# ${inlineDomToMd(el)}`.trim());
        break;
      case "H2":
        blocks.push(`## ${inlineDomToMd(el)}`.trim());
        break;
      case "H3":
      case "H4":
      case "H5":
      case "H6":
        blocks.push(`### ${inlineDomToMd(el)}`.trim());
        break;
      case "UL":
        el.querySelectorAll(":scope > li").forEach((li) => blocks.push(`- ${inlineDomToMd(li).trim()}`));
        break;
      case "OL": {
        let i = 1;
        el.querySelectorAll(":scope > li").forEach((li) => blocks.push(`${i++}. ${inlineDomToMd(li).trim()}`));
        break;
      }
      case "LI":
        blocks.push(`- ${inlineDomToMd(el).trim()}`);
        break;
      default: {
        // A chip (or other inline) that landed at the editor root — keep its
        // reference rather than unwrapping to bare text.
        if (el.classList.contains("ins-chip")) {
          blocks.push(`@[${el.dataset.refType ?? ""}: ${el.dataset.refLabel ?? el.textContent ?? ""}]`);
          break;
        }
        const md = inlineDomToMd(el).trim();
        if (md) blocks.push(md);
      }
    }
  });
  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
