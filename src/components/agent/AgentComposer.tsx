/**
 * AgentComposer — the prompt box for the agent.
 *
 * Mentions and attachments live INLINE with the text as chips (a
 * contentEditable editor, same family as the SEO TokenField), styled
 * after the reference layout: chips in the prose, the model picker
 * bottom left, attach and send bottom right.
 *
 * Two scopes: "project" mentions collections, pages, components,
 * sections, and media; "workspace" mentions the workspace's projects so
 * a task can start from the dashboard and land inside the right site.
 *
 * Tiers stay Lite, Balanced, Max. With a workspace API key added, a
 * "Your models" section appears and those runs bill to the user's key.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, AtSign, Check, ChevronDown, Gauge, KeyRound, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPages } from "@/lib/cms/pages-store";
import { getCMSState } from "@/lib/cms/store";
import { useGovernance } from "@/lib/agent/governance-store";
import { SECTION_DEFS } from "@/components/cms/editor/sections/SectionSystem";
import { AGENT_SKILLS, type AgentSkill } from "@/lib/agent/skills";
import { projectCollections } from "@/lib/agent/simulate";
import { BYOK_PROVIDERS, byokActions, useByok } from "@/lib/agent/byok-store";
import { AI_TIER_ORDER, tierAllowed, tierGateNote, type AiTier } from "@/lib/billing/pricing";
import type { SitePlanId } from "@/lib/cms/types";
import type { ContextRef, ContextRefKind } from "@/lib/agent/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TIER_META: Record<AiTier, { label: string; speed: string }> = {
  lite: { label: "Lite", speed: "Fastest" },
  balanced: { label: "Balanced", speed: "Balanced speed and quality" },
  max: { label: "Max", speed: "Best quality, slower" },
};

/* Inline 12px icons for chips (manual DOM, so plain SVG strings). */
const CHIP_ICONS: Partial<Record<ContextRefKind | "skill", string>> = {
  collection:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>',
  page: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
  component:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>',
  section:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>',
  media:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  project:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  skill:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>',
};

const KIND_GROUP_LABEL: Partial<Record<ContextRefKind, string>> = {
  collection: "Collections",
  page: "Pages",
  component: "Components",
  section: "Sections",
  media: "Media",
  project: "Projects",
};

const ACCEPTED_FILES = ".png,.jpg,.jpeg,.gif,.webp,.svg,.md,.csv,.pdf,.mp4";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface ComposerSubmit {
  prompt: string;
  tier: AiTier;
  context: ContextRef[];
  skillId?: string;
  model?: string;
}

interface Props {
  projectId?: string;
  wsSlug: string;
  sitePlan: SitePlanId;
  scope?: "project" | "workspace";
  size?: "hero" | "compact";
  autoFocus?: boolean;
  /** Prefill, e.g. from a suggestion row. */
  seed?: string;
  onSubmit: (input: ComposerSubmit) => void;
  disabled?: boolean;
}

interface MentionItem {
  kind: ContextRefKind;
  id: string;
  label: string;
}

export function AgentComposer({
  projectId,
  wsSlug,
  sitePlan,
  scope = "project",
  size = "compact",
  autoFocus,
  seed,
  onSubmit,
  disabled,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tier, setTier] = useState<AiTier>(tierAllowed(sitePlan, "balanced") ? "balanced" : "lite");
  const [highlight, setHighlight] = useState(0);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [empty, setEmpty] = useState(!(seed && seed.trim()));
  const [keyDialog, setKeyDialog] = useState(false);
  const byok = useByok(wsSlug);
  // Workspace governance: hide personal keys entirely when disallowed.
  const byokPermitted = useGovernance(getCMSState().workspaces.find((w) => w.slug === wsSlug)?.id ?? "").byokAllowed;

  const effectiveTier: AiTier = tierAllowed(sitePlan, tier)
    ? tier
    : tierAllowed(sitePlan, "balanced")
      ? "balanced"
      : "lite";
  const activeModel = byok?.activeModel ?? null;

  /* ------------------------------------------------------------ editor */

  useEffect(() => {
    if (seed && editorRef.current) {
      editorRef.current.textContent = seed;
      setEmpty(false);
      placeCaretAtEnd(editorRef.current);
    } else if (autoFocus && editorRef.current && !disabled) {
      editorRef.current.focus();
    }
    // seed only applies on mount; parents remount with a key to reseed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeCaretAtEnd(el: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    el.focus();
  }

  function plainText(): string {
    const el = editorRef.current;
    if (!el) return "";
    let out = "";
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? "";
      else if ((n as HTMLElement).tagName === "BR") out += " ";
      else if (!(n as HTMLElement).dataset?.kind) out += n.textContent ?? "";
    });
    return out;
  }

  function collectChips(): { context: ContextRef[]; skillId?: string } {
    const el = editorRef.current;
    const context: ContextRef[] = [];
    let skillId: string | undefined;
    el?.querySelectorAll<HTMLElement>("[data-kind]").forEach((chip) => {
      const kind = chip.dataset.kind as ContextRefKind | "skill";
      if (kind === "skill") skillId = chip.dataset.id;
      else context.push({ kind, id: chip.dataset.id ?? "", label: chip.dataset.label ?? "" });
    });
    return { context, skillId };
  }

  function syncQueries() {
    const el = editorRef.current;
    if (!el) return;
    setEmpty(plainText().trim() === "" && !el.querySelector("[data-kind]"));

    const sel = window.getSelection();
    const anchor = sel?.anchorNode ?? null;
    if (!sel || !sel.isCollapsed || !anchor || !el.contains(anchor) || anchor.nodeType !== Node.TEXT_NODE) {
      setMentionQuery(null);
      setSlashQuery(null);
      return;
    }
    const before = (anchor.textContent ?? "").slice(0, sel.anchorOffset);
    const mention = before.match(/@([\w-]*)$/);
    setMentionQuery(mention ? mention[1].toLowerCase() : null);

    const hasSkill = !!el.querySelector('[data-kind="skill"]');
    const whole = plainText().trim();
    const slash = !hasSkill && /^\/[\w-]*$/.test(whole) ? whole.slice(1).toLowerCase() : null;
    setSlashQuery(slash);
    setHighlight(0);
  }

  function makeChip(kind: ContextRefKind | "skill", id: string, label: string): HTMLElement {
    const chip = document.createElement("span");
    chip.contentEditable = "false";
    chip.dataset.kind = kind;
    chip.dataset.id = id;
    chip.dataset.label = label;
    chip.className = cn(
      "mx-0.5 inline-flex translate-y-[2px] items-center gap-1 rounded-md px-1.5 py-0.5 align-baseline text-[11.5px] font-medium leading-none",
      "[&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0",
      kind === "skill"
        ? "bg-[color:color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary"
        : "bg-[color:var(--s2)] text-foreground",
    );
    chip.innerHTML = `${CHIP_ICONS[kind] ?? ""}<span>${escapeHtml(label)}</span>`;
    return chip;
  }

  function insertMentionChip(item: MentionItem) {
    const el = editorRef.current;
    const sel = window.getSelection();
    const anchor = sel?.anchorNode;
    if (!el || !sel || !anchor || anchor.nodeType !== Node.TEXT_NODE) return;
    const text = anchor as Text;
    const before = (text.textContent ?? "").slice(0, sel.anchorOffset);
    const m = before.match(/@([\w-]*)$/);
    if (m) text.deleteData(sel.anchorOffset - m[0].length, m[0].length);

    const chip = makeChip(item.kind, item.id, item.label);
    const space = document.createTextNode(" ");
    const range = sel.getRangeAt(0);
    range.insertNode(space);
    range.insertNode(chip);
    range.setStartAfter(space);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    setMentionQuery(null);
    setEmpty(false);
    el.focus();
  }

  function insertSkillChip(s: AgentSkill) {
    const el = editorRef.current;
    if (!el) return;
    // The slash command is the whole text; replace it with the chip.
    el.innerHTML = "";
    el.appendChild(makeChip("skill", s.id, s.label));
    el.appendChild(document.createTextNode(" "));
    placeCaretAtEnd(el);
    setSlashQuery(null);
    setEmpty(false);
  }

  function attachFiles(files: FileList | null) {
    const el = editorRef.current;
    if (!el || !files || files.length === 0) return;
    for (const f of Array.from(files)) {
      el.appendChild(makeChip("file", f.name, f.name));
      el.appendChild(document.createTextNode(" "));
    }
    setEmpty(false);
    placeCaretAtEnd(el);
  }

  /* -------------------------------------------------------------- menu */

  const mentionItems: MentionItem[] = useMemo(() => {
    if (mentionQuery === null) return [];
    const s = getCMSState();
    let pool: MentionItem[] = [];

    const itemsForProject = (pid: string): MentionItem[] => [
      ...projectCollections(pid).map((c) => ({ kind: "collection" as const, id: c.id, label: c.name })),
      ...getPages(pid).map((p) => ({ kind: "page" as const, id: p.path, label: p.title })),
      ...s.components
        .filter((c) => c.projectId === pid)
        .map((c) => ({ kind: "component" as const, id: c.id, label: c.name })),
      ...SECTION_DEFS.map((d) => ({ kind: "section" as const, id: d.type, label: d.name })),
      ...s.media
        .filter((m) => m.projectId === pid)
        .slice(0, 8)
        .map((m) => ({ kind: "media" as const, id: m.id, label: m.name })),
    ];

    if (scope === "workspace") {
      const ws = s.workspaces.find((w) => w.slug === wsSlug);
      pool = s.projects
        .filter((p) => p.workspaceId === ws?.id)
        .map((p) => ({ kind: "project" as const, id: p.id, label: p.name }));
      // Tagging a project opens up everything inside it.
      const tagged = collectChips().context.find((c) => c.kind === "project");
      if (tagged) pool = [...pool, ...itemsForProject(tagged.id)];
    } else if (projectId) {
      pool = itemsForProject(projectId);
    }

    const existing = new Set(
      collectChips().context.map((c) => `${c.kind}:${c.id}`),
    );
    return pool
      .filter((i) => !existing.has(`${i.kind}:${i.id}`))
      .filter((i) => i.label.toLowerCase().includes(mentionQuery))
      .slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionQuery, projectId, scope, wsSlug]);

  const skillItems = useMemo(() => {
    if (slashQuery === null || scope === "workspace") return [];
    return AGENT_SKILLS.filter(
      (s) => s.id.includes(slashQuery) || s.label.toLowerCase().includes(slashQuery),
    );
  }, [slashQuery, scope]);

  const menuOpen = mentionItems.length > 0 || skillItems.length > 0;

  /* ------------------------------------------------------------ submit */

  const canSend = !disabled && !empty && (scope !== "workspace" || collectChipsHasProject());

  function collectChipsHasProject(): boolean {
    return !!editorRef.current?.querySelector('[data-kind="project"]');
  }

  const submit = () => {
    if (disabled) return;
    const { context, skillId } = collectChips();
    const prompt = plainText().replace(/ /g, " ").trim();
    const skill = skillId ? AGENT_SKILLS.find((s) => s.id === skillId) : undefined;
    if (!prompt && !skill) return;
    if (scope === "workspace" && !context.some((c) => c.kind === "project")) {
      toast("Tag the project first", { description: "Type @ and pick the site this task is for." });
      return;
    }
    onSubmit({
      prompt: prompt || skill?.suggestion || "",
      tier: effectiveTier,
      context,
      skillId,
      model: activeModel ?? undefined,
    });
    if (editorRef.current) editorRef.current.innerHTML = "";
    setEmpty(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (menuOpen) {
      const count = mentionItems.length || skillItems.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % count);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + count) % count);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (mentionItems.length > 0) insertMentionChip(mentionItems[highlight] ?? mentionItems[0]);
        else insertSkillChip(skillItems[highlight] ?? skillItems[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setMentionQuery(null);
        setSlashQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const hero = size === "hero";

  return (
    <div className="relative">
      {/* mention / skill menu: above in the dock, below on the hero page */}
      {menuOpen && (
        <div
          id="agent-composer-menu"
          role="listbox"
          aria-label={mentionItems.length > 0 ? "Add as context" : "Skills"}
          className={cn(
            "absolute left-0 z-30 max-h-[280px] w-full max-w-[380px] overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] py-1 shadow-[var(--shadow-3)]",
            hero ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {mentionItems.length > 0 ? (
            <MentionList items={mentionItems} highlight={highlight} onHover={setHighlight} onPick={insertMentionChip} />
          ) : (
            skillItems.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="option"
                id={`agent-composer-opt-${i}`}
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => insertSkillChip(s)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                  i === highlight && "bg-[color:var(--color-row-hover)]",
                )}
              >
                <s.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-foreground">
                    {s.label}
                    <span className="ml-1.5 font-mono text-[10.5px] text-muted-foreground/70">{s.command}</span>
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">{s.blurb}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-[var(--shadow-card)] transition-shadow focus-within:border-[color:color-mix(in_oklab,var(--primary)_40%,transparent)]",
          hero ? "p-4" : "p-3",
        )}
      >
        {/* the editor: chips live inline with the text */}
        <div className="relative">
          {empty && (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-0 top-0 text-muted-foreground/60",
                hero ? "text-[15px] leading-relaxed" : "text-[13px] leading-relaxed",
              )}
            >
              {disabled
                ? "Your seat can view agent tasks, not start them"
                : scope === "workspace"
                  ? "Ask about any site. @ to pick the project"
                  : "Ask the agent, @ for context, / for skills"}
            </span>
          )}
          <div
            ref={editorRef}
            contentEditable={!disabled}
            role="combobox"
            aria-label="Ask the agent"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? "agent-composer-menu" : undefined}
            aria-activedescendant={menuOpen ? `agent-composer-opt-${highlight}` : undefined}
            aria-autocomplete="list"
            aria-disabled={disabled}
            data-autofocus={autoFocus ? "true" : undefined}
            onInput={syncQueries}
            onKeyUp={syncQueries}
            onClick={syncQueries}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              e.preventDefault();
              const text = e.clipboardData.getData("text/plain");
              document.execCommand("insertText", false, text);
            }}
            className={cn(
              "block w-full whitespace-pre-wrap break-words text-foreground outline-none",
              hero ? "min-h-[52px] text-[15px] leading-relaxed" : "min-h-[24px] text-[13px] leading-relaxed",
              disabled && "cursor-not-allowed opacity-70",
            )}
          />
        </div>

        {/* bottom bar: model left, actions right */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground disabled:opacity-40"
              >
                {activeModel ? <KeyRound className="h-3.5 w-3.5" /> : <Gauge className="h-3.5 w-3.5" />}
                {activeModel ?? TIER_META[effectiveTier].label}
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                Speed
              </DropdownMenuLabel>
              {AI_TIER_ORDER.map((t) => {
                const allowed = tierAllowed(sitePlan, t);
                return (
                  <DropdownMenuItem
                    key={t}
                    disabled={!allowed}
                    onSelect={() => {
                      if (!allowed) return;
                      setTier(t);
                      if (activeModel) byokActions.setModel(wsSlug, null);
                    }}
                    className="gap-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-medium">{TIER_META[t].label}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {allowed ? TIER_META[t].speed : tierGateNote(sitePlan, t)}
                      </span>
                    </span>
                    {!activeModel && effectiveTier === t && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </DropdownMenuItem>
                );
              })}
              {byokPermitted && <DropdownMenuSeparator />}
              {!byokPermitted ? null : byok ? (
                <>
                  <DropdownMenuLabel className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Your models · {byok.provider}
                  </DropdownMenuLabel>
                  {byok.models.map((m) => (
                    <DropdownMenuItem key={m} onSelect={() => byokActions.setModel(wsSlug, m)} className="gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[12px]">{m}</span>
                        <span className="block text-[11px] text-muted-foreground">Billed to your key, no credits</span>
                      </span>
                      {activeModel === m && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onSelect={() => setKeyDialog(true)} className="gap-2 text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" /> Manage key
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onSelect={() => setKeyDialog(true)} className="gap-2">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium">Use your own API key</span>
                    <span className="block text-[11px] text-muted-foreground">Pick the exact model, billed to your key</span>
                  </span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              title="Mention"
              aria-label="Mention"
              disabled={disabled}
              onClick={() => {
                const el = editorRef.current;
                if (!el) return;
                placeCaretAtEnd(el);
                document.execCommand("insertText", false, "@");
                syncQueries();
              }}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground disabled:opacity-40"
            >
              <AtSign className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPTED_FILES}
              className="hidden"
              onChange={(e) => {
                attachFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              title="Attach a file"
              aria-label="Attach a file"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground disabled:opacity-40"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send"
              className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>

      {keyDialog && <ByokDialog wsSlug={wsSlug} onClose={() => setKeyDialog(false)} />}
    </div>
  );
}

/* --------------------------------------------------------- mention list */

function MentionList({
  items,
  highlight,
  onHover,
  onPick,
}: {
  items: MentionItem[];
  highlight: number;
  onHover: (i: number) => void;
  onPick: (item: MentionItem) => void;
}) {
  let lastKind: ContextRefKind | null = null;
  return (
    <>
      {items.map((item, i) => {
        const header = item.kind !== lastKind ? KIND_GROUP_LABEL[item.kind] : null;
        lastKind = item.kind;
        return (
          <div key={`${item.kind}:${item.id}`}>
            {header && (
              <div aria-hidden className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                {header}
              </div>
            )}
            <button
              type="button"
              role="option"
              id={`agent-composer-opt-${i}`}
              aria-selected={i === highlight}
              onMouseEnter={() => onHover(i)}
              onClick={() => onPick(item)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-foreground",
                i === highlight && "bg-[color:var(--color-row-hover)]",
              )}
            >
              <span
                aria-hidden
                className="grid h-4 w-4 shrink-0 place-items-center text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5"
                dangerouslySetInnerHTML={{ __html: CHIP_ICONS[item.kind] ?? "" }}
              />
              <span className="truncate">{item.label}</span>
              <span className="ml-auto text-[10.5px] capitalize text-muted-foreground/70">{item.kind}</span>
            </button>
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------ key dialog */

function ByokDialog({ wsSlug, onClose }: { wsSlug: string; onClose: () => void }) {
  const byok = useByok(wsSlug);
  const [provider, setProvider] = useState(BYOK_PROVIDERS[0].id);
  const [key, setKey] = useState("");
  const canSave = key.trim().length >= 8;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your API key"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="relative w-full max-w-[420px] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-[var(--shadow-3)]"
      >
        <div className="flex items-start gap-3 border-b border-[color:var(--border-hairline)] px-5 py-4">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
            <KeyRound className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-foreground">Your API key</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Run the agent on your own provider account. Usage bills to your key, not to credits.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {byok && (
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-foreground">{byok.provider}</span>
                <span className="block font-mono text-[11px] text-muted-foreground">{byok.maskedKey}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  byokActions.removeKey(wsSlug);
                  toast.success("Key removed");
                  onClose();
                }}
                className="text-[12px] font-medium text-destructive transition-opacity hover:opacity-80"
              >
                Remove
              </button>
            </div>
          )}
          <div>
            <label className="text-[12px] font-medium text-foreground">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 text-[13px] text-foreground outline-none focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
            >
              {BYOK_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground">API key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Paste your key"
              autoFocus
              className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 font-mono text-[13px] text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground/60 focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Stored for this workspace only. In this demo the key never leaves your browser.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md border border-[color:var(--color-border)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              byokActions.saveKey(wsSlug, provider, key);
              toast.success("Key added. Pick a model from the selector.");
              onClose();
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <KeyRound className="h-3.5 w-3.5" /> Save key
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
