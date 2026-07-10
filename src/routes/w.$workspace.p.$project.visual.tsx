import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Accessibility,
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Columns3,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Info,
  LayoutTemplate,
  Lock,
  Megaphone,
  MessageSquare,
  MessageSquarePlus,
  Monitor,
  MoreHorizontal,
  MousePointer2,
  PanelLeft,
  Plus,
  RectangleHorizontal,
  Repeat2,
  Rocket,
  RotateCw,
  Save,
  ScanLine,
  Search,
  Send,
  Settings2,
  Smartphone,
  SquarePen,
  Tablet,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  SectionLibrary,
  SectionRenderer,
  TemplatePicker,
  createSection,
  getSectionDef,
  instantiateTemplate,
  type PageTemplate,
  type SectionDef,
  type SectionInstance,
} from "@/components/cms/editor/sections/SectionSystem";
import { newPageId, pagesActions, usePages, type PageDoc } from "@/lib/cms/pages-store";
import { PublishMenu } from "@/components/cms/editor/PublishMenu";
import { PageSettingsDialog } from "@/components/cms/editor/PageSettingsDialog";
import {
  ROLE_INFO,
  ROLE_ORDER,
  canCompose,
  canEditContent,
  canPublish as roleCanPublish,
  canSeeDeveloper,
  canViewAs,
  setViewAs,
  useEffectiveRole,
  type WorkspaceRole,
} from "@/lib/workspace/my-role";
import {
  CommentLayer,
  CommentPin,
  CommentStyles,
  CommentsPanel,
  ME,
  NewCommentPopover,
  ThreadPopover,
  newId,
  newMessage,
  rangeFromOffsets,
  type CommentThread,
  type Surface,
} from "@/components/cms/editor/comments/CommentSystem";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { useViewportTier } from "@/lib/device";
import { useProjectPresence } from "@/lib/workspace/presence-store";
import { PresenceCanvasLayer } from "@/components/cms/presence/PresenceCanvasLayer";
import { RichTextToolbar } from "@/components/cms/editor/preview/RichTextToolbar";
import { ComparePageDialog, pageDiffCount } from "@/components/cms/editor/preview/ComparePageDialog";
import { GitCompareArrows } from "lucide-react";

export const Route = createFileRoute("/w/$workspace/p/$project/visual")({
  validateSearch: (s: Record<string, unknown>): { page?: string; new?: boolean } => ({
    page: typeof s.page === "string" ? s.page : undefined,
    new: s.new === true || s.new === "1" || s.new === "true" ? true : undefined,
  }),
  component: VisualEditor,
});

type ContentState = "draft" | "published" | "modified" | "scheduled" | "archived";
type PreviewMode = "edit" | "comment";
type Device = "desktop" | "tablet" | "mobile" | "landscape";

const DEVICE_META: Record<Device, { label: string; width: number | null; icon: typeof Monitor }> = {
  desktop: { label: "Desktop", width: null, icon: Monitor },
  tablet: { label: "Tablet", width: 768, icon: Tablet },
  mobile: { label: "Mobile", width: 390, icon: Smartphone },
  landscape: { label: "Landscape", width: 740, icon: RectangleHorizontal },
};

/** Canvas accessibility preview — simulate how the page reads for low vision / color blindness. */
type Vision = "none" | "grayscale" | "colorblind" | "blurred";
const VISION_FILTER: Record<Vision, string> = {
  none: "",
  grayscale: "grayscale(1)",
  colorblind: "url(#bcms-deuteranopia)",
  blurred: "blur(1.6px)",
};
const VISION_OPTIONS: { id: Vision; label: string }[] = [
  { id: "none", label: "None" },
  { id: "grayscale", label: "Grayscale" },
  { id: "colorblind", label: "Color blind" },
  { id: "blurred", label: "Blurred" },
];

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}


const STATE_META: Record<ContentState, { label: string; dot: string; text: string }> = {
  draft: { label: "Draft", dot: "bg-muted-foreground/60", text: "text-muted-foreground" },
  published: { label: "Published", dot: "bg-emerald-400", text: "text-emerald-500" },
  modified: { label: "Unpublished changes", dot: "bg-amber-400", text: "text-amber-500" },
  scheduled: { label: "Scheduled", dot: "bg-sky-400", text: "text-sky-500" },
  archived: { label: "Archived", dot: "bg-muted-foreground/40", text: "text-muted-foreground/70" },
};

/** A page is an ordered list of section instances (stored in pages-store). */
type Page = PageDoc;
// A seeded thread so collaboration is visible immediately (and shows in both modes).
const SEED_THREADS: Record<string, CommentThread[]> = {
  "/": [
    {
      id: "th_seed_1",
      fieldKey: "s_home_hero.headline",
      fieldLabel: "Headline",
      quote: "modern product teams",
      start: 21,
      end: 41,
      messages: [
        {
          id: "m_seed_1",
          author: "Arnab Dhar",
          body: "Can we make this punchier? Maybe lead with the outcome, not the audience.",
          ts: Date.now() - 1000 * 60 * 60 * 3,
          reactions: [{ emoji: "👍", by: "Kiran Rao" }],
        },
        {
          id: "m_seed_2",
          author: "Himanshu Sahu",
          body: "Good call @Arnab Dhar, I'll draft two variants and share here.",
          ts: Date.now() - 1000 * 60 * 60 * 2,
          reactions: [],
        },
      ],
    },
  ],
};

function VisualEditor() {
  const { workspace, project } = Route.useParams();
  const search = Route.useSearch();
  const pr = getProjectBySlug(workspace, project);
  const projectId = pr?.id ?? project;
  const staging = `${pr?.slug ?? project}.bettercms.site`;

  const [modeRaw, setMode] = useState<"visual" | "form">("visual");
  // Phones edit content, not layout: the canvas needs pointer precision and
  // room, so small screens pin the editor to form (content) mode.
  const tier = useViewportTier();
  const mode = tier === "mobile" ? "form" : modeRaw;
  const [previewMode, setPreviewMode] = useState<PreviewMode>("edit");
  const [device, setDevice] = useState<Device>("desktop");
  const [showGrid, setShowGrid] = useState(false);
  const [xray, setXray] = useState(false);
  const [vision, setVision] = useState<Vision>("none");
  const [showBanner, setShowBanner] = useState(true);
  // Pages come from the shared per-project store (also read by the Content tab).
  const pages = usePages(projectId);
  const [activePath, setActivePath] = useState(() => (search.page && pages.some((p) => p.path === search.page) ? search.page : "/"));

  const active = pages.find((p) => p.path === activePath) ?? pages[0];
  const state = active.state;

  // Keep the canvas in sync when ?page= changes while already mounted
  // (e.g. jumping to a teammate from the presence popover).
  useEffect(() => {
    if (search.page && search.page !== activePath && pages.some((p) => p.path === search.page)) {
      setActivePath(search.page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.page]);

  // Role comes from your workspace seat, clamped by the cascading view-as.
  const { actual, effective } = useEffectiveRole(workspace);
  const canBuild = canCompose(effective);
  const canEdit = canEditContent(effective);
  const showDev = canSeeDeveloper(effective);
  const publishAllowed = roleCanPublish(effective);
  const composing = canBuild && previewMode === "edit";
  const viewAsOptions = ROLE_ORDER.filter((r) => canViewAs(actual, r));

  // Section library modal: the index to insert at, or null when closed.
  const [libraryAt, setLibraryAt] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [comparePageOpen, setComparePageOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);

  // Page templates: the create-page picker + templates saved from pages.
  const [pagePicker, setPagePicker] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<PageTemplate[]>([]);
  const [tplName, setTplName] = useState<string | null>(null);

  // Reviewers can only comment; never leave them in edit mode.
  useEffect(() => {
    if (!canEdit) setPreviewMode("comment");
  }, [canEdit]);

  // Arriving from "New page" in the Content tab opens the template picker.
  useEffect(() => {
    if (search.new && canBuild) setPagePicker(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canvasRef = useRef<HTMLDivElement>(null);
  const formContentRef = useRef<HTMLDivElement>(null);

  // Simulated multiplayer: teammates moving around this project's surfaces.
  const presencePeers = useProjectPresence(pr?.id);

  // comments — anchored to content fields, so a thread shows in both visual and form modes.
  const [threadsByPage, setThreadsByPage] = useState<Record<string, CommentThread[]>>(SEED_THREADS);
  const threads = threadsByPage[activePath] ?? [];
  const [openThread, setOpenThread] = useState<{ id: string; surface: Surface } | null>(null);
  const [draft, setDraft] = useState<{ fieldKey: string; fieldLabel: string; quote: string; start?: number; end?: number; surface: Surface } | null>(null);
  const [sel, setSel] = useState<{ rect: DOMRect; fieldKey: string; fieldLabel: string; quote: string; start: number; end: number } | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [recalc, setRecalc] = useState(0);

  const activeThread = openThread ? threads.find((t) => t.id === openThread.id) ?? null : null;
  const activeFieldKey = activeThread?.fieldKey ?? draft?.fieldKey ?? null;
  const openCount = threads.filter((t) => !t.resolved).length;

  function patchPage(patch: (p: Page) => Page) {
    pagesActions.update(projectId, activePath, patch);
  }
  const touched = (s: ContentState): ContentState => (s === "published" ? "modified" : s);
  function setField(sectionId: string, key: string, value: string) {
    patchPage((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.id === sectionId ? { ...s, content: { ...s.content, [key]: value } } : s)),
      state: touched(p.state),
    }));
  }
  /** Resolve a `${sectionId}.${key}` field id to its current value. */
  function getFieldValue(fieldId: string): string {
    const dot = fieldId.indexOf(".");
    if (dot < 0) return "";
    const sid = fieldId.slice(0, dot);
    const key = fieldId.slice(dot + 1);
    const s = active.sections.find((x) => x.id === sid);
    if (!s) return "";
    return s.content[key] ?? getSectionDef(s.type)?.defaults[key] ?? "";
  }

  // ---- section composition (marketer + developer only) ----
  function addSection(type: string, variantId: string) {
    const s = createSection(type, variantId);
    const at = Math.min(libraryAt ?? active.sections.length, active.sections.length);
    patchPage((p) => ({
      ...p,
      sections: [...p.sections.slice(0, at), s, ...p.sections.slice(at)],
      state: touched(p.state),
    }));
    setLibraryAt(null);
    setFlashId(s.id);
    toast.success(`${getSectionDef(type)?.name ?? "Section"} added`);
    requestAnimationFrame(() => {
      canvasRef.current?.querySelector(`[data-sec="${s.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    window.setTimeout(() => setFlashId(null), 1400);
  }
  function moveSection(id: string, dir: -1 | 1) {
    patchPage((p) => {
      const i = p.sections.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.sections.length) return p;
      const arr = [...p.sections];
      const [s] = arr.splice(i, 1);
      arr.splice(j, 0, s);
      return { ...p, sections: arr, state: touched(p.state) };
    });
  }
  function duplicateSection(id: string) {
    patchPage((p) => {
      const i = p.sections.findIndex((s) => s.id === id);
      if (i < 0) return p;
      const src = p.sections[i];
      const copy = { ...createSection(src.type, src.variant), content: { ...src.content } };
      setFlashId(copy.id);
      return { ...p, sections: [...p.sections.slice(0, i + 1), copy, ...p.sections.slice(i + 1)], state: touched(p.state) };
    });
    window.setTimeout(() => setFlashId(null), 1400);
  }
  function removeSection(id: string) {
    const name = getSectionDef(active.sections.find((s) => s.id === id)?.type ?? "")?.name ?? "Section";
    patchPage((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== id), state: touched(p.state) }));
    toast.success(`${name} removed`);
  }
  function setSectionVariant(id: string, variantId: string) {
    patchPage((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.id === id ? { ...s, variant: variantId } : s)),
      state: touched(p.state),
    }));
  }
  function createPage() {
    setPagePicker(true);
  }
  function createFromTemplate(t: PageTemplate | null) {
    const base = t ? t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "new-page" : "new-page";
    let path = `/${base}`;
    let n = 1;
    while (pages.some((p) => p.path === path)) path = `/${base}-${++n}`;
    const pg: Page = { id: newPageId(), path, title: t?.name ?? "New page", state: "draft", sections: t ? instantiateTemplate(t) : [], updatedAt: Date.now() };
    pagesActions.add(projectId, pg);
    setPagePicker(false);
    selectPage(path);
    setMode("visual");
    if (!t) setLibraryAt(0);
    toast.success(t ? `Page created from ${t.name}` : "Page created. Add your first section.");
  }
  function saveAsTemplate(name: string) {
    const t: PageTemplate = {
      id: newId("tpl"),
      name,
      blurb: `Saved from ${active.title}`,
      icon: LayoutTemplate,
      custom: true,
      sections: active.sections.map((s) => ({ type: s.type, variant: s.variant, content: { ...s.content } })),
    };
    setCustomTemplates((l) => [t, ...l]);
    setTplName(null);
    toast.success(`Template saved. It now shows up under Create a page.`);
  }

  function selectPage(path: string) {
    setPublishOpen(false);
    setActivePath(path);
    setOpenThread(null);
    setDraft(null);
    setSel(null);
  }

  function updateThreads(fn: (list: CommentThread[]) => CommentThread[]) {
    setThreadsByPage((m) => ({ ...m, [activePath]: fn(m[activePath] ?? []) }));
  }
  function fieldRect(surface: Surface, fieldKey: string): DOMRect | null {
    const pick = (c: HTMLElement | null) => {
      const el = c?.querySelector<HTMLElement>(`[data-field="${CSS.escape(fieldKey)}"]`);
      return el ? el.getBoundingClientRect() : null;
    };
    const primary = surface === "form" ? formContentRef.current : canvasRef.current;
    const fallback = surface === "form" ? canvasRef.current : formContentRef.current;
    return pick(primary) ?? pick(fallback);
  }
  function startFieldComment(fieldKey: string, fieldLabel: string, surface: Surface) {
    const raw = stripHtml(getFieldValue(fieldKey));
    const quote = raw.length > 60 ? raw.slice(0, 57) + "…" : raw;
    setSel(null);
    setOpenThread(null);
    setDraft({ fieldKey, fieldLabel, quote, surface });
  }
  function createThread(body: string, image?: string) {
    if (!draft) return;
    const t: CommentThread = {
      id: newId("th"),
      fieldKey: draft.fieldKey,
      fieldLabel: draft.fieldLabel,
      quote: draft.quote,
      start: draft.start,
      end: draft.end,
      messages: [newMessage(ME, body, image)],
    };
    updateThreads((l) => [...l, t]);
    setDraft(null);
    setSel(null);
    setOpenThread({ id: t.id, surface: draft.surface });
  }
  function addReply(id: string, body: string, image?: string) {
    updateThreads((l) => l.map((t) => (t.id === id ? { ...t, messages: [...t.messages, newMessage(ME, body, image)] } : t)));
  }
  function reactMsg(threadId: string, msgId: string, emoji: string) {
    updateThreads((l) =>
      l.map((t) =>
        t.id !== threadId
          ? t
          : {
              ...t,
              messages: t.messages.map((m) => {
                if (m.id !== msgId) return m;
                const mine = m.reactions.find((r) => r.by === ME && r.emoji === emoji);
                return {
                  ...m,
                  reactions: mine
                    ? m.reactions.filter((r) => !(r.by === ME && r.emoji === emoji))
                    : [...m.reactions, { emoji, by: ME }],
                };
              }),
            },
      ),
    );
  }
  function deleteMsg(threadId: string, msgId: string) {
    const t = threads.find((x) => x.id === threadId);
    const removesThread = !!t && (t.messages[0]?.id === msgId || t.messages.length <= 1);
    updateThreads((l) =>
      l.flatMap((x) => {
        if (x.id !== threadId) return [x];
        if (x.messages[0]?.id === msgId || x.messages.length <= 1) return [];
        return [{ ...x, messages: x.messages.filter((m) => m.id !== msgId) }];
      }),
    );
    if (removesThread) setOpenThread(null);
  }
  function editMsg(threadId: string, msgId: string, body: string) {
    updateThreads((l) =>
      l.map((t) =>
        t.id !== threadId ? t : { ...t, messages: t.messages.map((m) => (m.id === msgId ? { ...m, body, edited: true } : m)) },
      ),
    );
  }
  function resolveThread(id: string) {
    updateThreads((l) => l.map((t) => (t.id === id ? { ...t, resolved: !t.resolved } : t)));
  }
  function openThreadById(id: string) {
    const t = threads.find((x) => x.id === id);
    if (!t) return;
    setDraft(null);
    const surface: Surface = mode === "visual" ? "canvas" : "form";
    setOpenThread({ id, surface });
    requestAnimationFrame(() => {
      const c = surface === "form" ? formContentRef.current : canvasRef.current;
      c?.querySelector(`[data-field="${CSS.escape(t.fieldKey)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }
  function copyLink(id: string) {
    const url = `${location.origin}${location.pathname}?comment=${id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    toast.success("Comment link copied");
  }
  function startSelComment() {
    if (!sel) return;
    setDraft({ fieldKey: sel.fieldKey, fieldLabel: sel.fieldLabel, quote: sel.quote, start: sel.start, end: sel.end, surface: "canvas" });
    setSel(null);
  }

  // reposition pins on layout changes
  useEffect(() => {
    setRecalc((n) => n + 1);
  }, [active.sections, device, showBanner, mode, activePath, previewMode]);

  // open thread from a shared ?comment= link
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("comment");
    if (id) setOpenThread({ id, surface: "canvas" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // in comment mode, releasing a text selection inside a field offers a "Comment" button
  useEffect(() => {
    if (previewMode !== "comment") {
      setSel(null);
      return;
    }
    function onUp() {
      const s = window.getSelection();
      if (!s || s.isCollapsed || s.rangeCount === 0) return setSel(null);
      const range = s.getRangeAt(0);
      let node: Node | null = range.startContainer;
      let field: HTMLElement | null = null;
      while (node && node !== canvasRef.current) {
        if (node instanceof HTMLElement && node.dataset.field) {
          field = node;
          break;
        }
        node = node.parentNode;
      }
      if (!field || !canvasRef.current?.contains(field)) return setSel(null);
      const quote = s.toString();
      if (!quote.trim()) return setSel(null);
      const pre = document.createRange();
      pre.selectNodeContents(field);
      pre.setEnd(range.startContainer, range.startOffset);
      const start = pre.toString().length;
      setSel({
        rect: range.getBoundingClientRect(),
        fieldKey: field.dataset.field!,
        fieldLabel: field.dataset.fieldLabel ?? field.dataset.field!,
        quote: quote.length > 60 ? quote.slice(0, 57) + "…" : quote,
        start,
        end: start + quote.length,
      });
    }
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, [previewMode]);

  // highlight the anchored text in the canvas via the CSS Custom Highlight API
  useEffect(() => {
    const HL = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const HLC = (window as unknown as { Highlight?: new (r: Range) => unknown }).Highlight;
    if (!HL || !HLC) return;
    HL.delete("bcms-comment");
    const key = activeThread?.fieldKey ?? draft?.fieldKey ?? null;
    const start = activeThread?.start ?? draft?.start;
    const end = activeThread?.end ?? draft?.end;
    const field = key ? canvasRef.current?.querySelector<HTMLElement>(`[data-field="${CSS.escape(key)}"]`) : null;
    if (field) {
      let range: Range | null = null;
      if (start != null && end != null) range = rangeFromOffsets(field, start, end);
      else {
        range = document.createRange();
        range.selectNodeContents(field);
      }
      if (range) HL.set("bcms-comment", new HLC(range) as never);
    }
    return () => {
      HL.delete("bcms-comment");
    };
  }, [activeThread, draft, active.sections, mode, recalc]);

  const meta = STATE_META[state];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[color:var(--canvas)]">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-[color:var(--topbar)] px-2 sm:gap-3 sm:px-3">
        <div className="flex items-center gap-2">
          <span className="hidden text-[13px] font-semibold text-foreground sm:inline">Visual editor</span>
          <span className="hidden items-center gap-1.5 rounded-full bg-[color:var(--s2)] px-2 py-0.5 text-[11px] font-medium sm:inline-flex">
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            <span className={meta.text}>{meta.label}</span>
          </span>
          {viewAsOptions.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title={`Preview the app as a role below yours. You are ${ROLE_INFO[actual].label}.`}
                  aria-label={`View as role, currently ${ROLE_INFO[effective].label}`}
                  className={cn(
                    "hidden h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium transition-colors md:inline-flex",
                    effective !== actual
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-[color:var(--color-border)] bg-[color:var(--card)] text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Eye className="h-3 w-3" />
                  {ROLE_INFO[effective].label}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[250px]">
                <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  View as
                </div>
                {viewAsOptions.map((r: WorkspaceRole) => {
                  const m = ROLE_INFO[r];
                  const Icon = m.icon;
                  return (
                    <DropdownMenuItem key={r} className="items-start gap-2 text-[13px]" onSelect={() => setViewAs(r === actual ? null : r)}>
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1">
                        <span className="block font-medium">
                          {m.label}
                          {r === actual && <span className="ml-1 text-[10.5px] font-normal text-muted-foreground">(you)</span>}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">{m.blurb}</span>
                      </span>
                      {effective === r && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="ml-2 hidden h-8 items-center gap-0.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] p-1 md:flex">
          {canEdit && (
            <button
              type="button"
              onClick={() => setMode("form")}
              className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors ${mode === "form" ? "bg-[color:var(--elevated)] text-foreground shadow-[var(--shadow-1)]" : "text-muted-foreground hover:text-foreground"}`}
            >
              <PanelLeft className="h-3.5 w-3.5" /> Form
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode("visual")}
            className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors ${mode === "visual" ? "bg-[color:var(--elevated)] text-foreground shadow-[var(--shadow-1)]" : "text-muted-foreground hover:text-foreground"}`}
          >
            <SquarePen className="h-3.5 w-3.5" /> Visual
          </button>
        </div>

        <div className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden />
        <PageSelect pages={pages} activePath={activePath} onSelect={selectPage} onCreate={canBuild ? createPage : undefined} />

        {canBuild && (
          <button
            type="button"
            onClick={() => setPageSettingsOpen(true)}
            title="Page settings & SEO"
            aria-label="Page settings and SEO"
            className="grid h-8 w-8 place-items-center rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          title="Comments"
          aria-pressed={showComments}
          className={cn(
            "ml-1 inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors",
            showComments
              ? "border-indigo-300 bg-indigo-50 text-indigo-700"
              : "border-[color:var(--color-border)] bg-[color:var(--card)] text-foreground hover:bg-[color:var(--color-row-hover)]",
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Comments</span>
          {openCount > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[9.5px] font-semibold text-white">{openCount}</span>
          )}
        </button>

        <div className="flex-1" />
        {mode === "visual" && (
          <div className="flex items-center gap-2">
            <DeviceBar device={device} onChange={setDevice} />
            <CanvasSettings
              showGrid={showGrid}
              onGrid={setShowGrid}
              xray={xray}
              onXray={setXray}
              vision={vision}
              onVision={setVision}
            />
          </div>
        )}
        <div className="flex-1" />

        {canEdit && (
          <span className="hidden items-center gap-1.5 pr-1 text-[11.5px] text-muted-foreground md:inline-flex" title="Every change is saved to your draft automatically">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Saved
          </span>
        )}
        {active.publishedSnapshot && (
          <button
            type="button"
            onClick={() => setComparePageOpen(true)}
            title="Compare the draft with the published page"
            className="relative inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            <GitCompareArrows className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Compare</span>
            {pageDiffCount(active) > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500/20 px-1 text-[10px] font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {pageDiffCount(active)}
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => window.open(`https://${staging}${active.path === "/" ? "" : active.path}`, "_blank")}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
        >
          <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Preview</span>
        </button>
        {publishAllowed && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPublishOpen((v) => !v)}
              aria-haspopup="dialog"
              aria-expanded={publishOpen}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
            >
              <Rocket className="h-3.5 w-3.5" /> Publish
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>
            {publishOpen && (
              <PublishMenu
                projectId={projectId}
                page={active}
                staging={staging}
                domain={pr?.domain}
                onClose={() => setPublishOpen(false)}
                onSaveTemplate={canBuild ? () => { setPublishOpen(false); setTplName(`${active.title} template`); } : undefined}
              />
            )}
          </div>
        )}
      </div>

      {/* Headless explanation */}
      {showBanner && showDev && (
        <div className="hidden items-start gap-2.5 border-b border-[color:var(--border-hairline)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)] px-4 py-2.5 sm:flex">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="flex-1 text-[12.5px] leading-relaxed text-foreground/85">
            This is a <span className="font-medium">headless project</span>. BetterCMS manages your content, SEO, forms,
            analytics, schema, redirects, sitemap, APIs, and visual editing. Your production frontend connects to
            BetterCMS using APIs or SDK.
          </p>
          <button
            type="button"
            onClick={() => setShowBanner(false)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {(mode === "form" || mode === "visual") && (
          <div className={`shrink-0 overflow-y-auto border-r border-border bg-background ${mode === "form" ? "mx-auto w-full max-w-[720px] border-r-0" : "w-[300px] lg:w-[360px]"}`}>
            <div ref={formContentRef} className={cn("relative", mode === "form" ? "px-4 py-6 sm:px-8 sm:py-8" : "px-5 py-5")}>
              <div className="mb-4">
                <div className="text-[13.5px] font-semibold text-foreground">{active.title}</div>
                <div className="text-[11.5px] text-muted-foreground">
                  Content entry · <span className="font-mono">{active.path}</span>
                </div>
              </div>
              <div className="space-y-5">
                {active.sections.map((s) => {
                  const def = getSectionDef(s.type);
                  if (!def) return null;
                  const variantName = def.variants.find((v) => v.id === s.variant)?.name;
                  return (
                    <div key={s.id} className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
                          <def.icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[12.5px] font-semibold text-foreground">{def.name}</span>
                        {def.variants.length > 1 && (
                          <span className="rounded-full bg-[color:var(--s2)] px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">{variantName}</span>
                        )}
                      </div>
                      <div className="space-y-4">
                        {def.fields.map((f) => {
                          const fieldId = `${s.id}.${f.key}`;
                          const fieldThreads = threads.filter((t) => t.fieldKey === fieldId);
                          const value = s.content[f.key] ?? def.defaults[f.key] ?? "";
                          return (
                            <div
                              key={f.key}
                              data-field={fieldId}
                              data-field-label={f.label}
                              className={cn("group relative rounded-lg transition-all", mode === "form" && activeFieldKey === fieldId && "ring-2 ring-indigo-300")}
                            >
                              <Field label={f.label}>
                                {f.multiline ? (
                                  <Textarea rows={2} value={stripHtml(value)} disabled={!canEdit} onChange={(e) => setField(s.id, f.key, e.target.value)} />
                                ) : (
                                  <Input value={stripHtml(value)} disabled={!canEdit} onChange={(e) => setField(s.id, f.key, e.target.value)} />
                                )}
                              </Field>
                              {mode === "form" && (
                                <div className="absolute right-1 top-0 flex items-center gap-1">
                                  {fieldThreads.map((t) => (
                                    <CommentPin key={t.id} thread={t} active={openThread?.id === t.id} onClick={() => { setDraft(null); setOpenThread({ id: t.id, surface: "form" }); }} />
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => startFieldComment(fieldId, f.label, "form")}
                                    title={`Comment on ${f.label}`}
                                    aria-label={`Comment on ${f.label}`}
                                    className="grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full rounded-bl-none border border-indigo-200 bg-white text-indigo-500 opacity-0 shadow-sm transition-all hover:scale-110 hover:opacity-100 group-hover:opacity-70"
                                  >
                                    <MessageSquarePlus className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {active.sections.length === 0 && (
                  <p className="rounded-xl border border-dashed border-[color:var(--color-border)] px-4 py-6 text-center text-[12px] text-muted-foreground">
                    No sections on this page yet. Add them in the Visual mode.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === "visual" && (
          <div className="flex min-w-0 flex-1 flex-col bg-[color:var(--s2)] p-4">
            <RichTextToolbar
              canvasRef={canvasRef}
              active={previewMode === "edit"}
              pages={pages.map((p) => ({ path: p.path, title: p.title }))}
            />
            <CanvasDefs />
            <div
              className="mx-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-white shadow-[var(--shadow-2)] transition-[width,max-width] duration-200"
              style={{
                width: DEVICE_META[device].width ?? "100%",
                maxWidth: DEVICE_META[device].width ?? 1000,
              }}
            >
              {/* browser chrome */}
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                </span>
                <div className="ml-2 flex flex-1 items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11.5px] text-slate-500 ring-1 ring-slate-200">
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span className="truncate font-mono">
                    {staging}
                    {active.path !== "/" ? active.path : ""}
                  </span>
                </div>
                {/* interaction mode */}
                <div className="flex h-7 items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => { setPreviewMode("edit"); setSel(null); }}
                      title="Edit content inline"
                      className={`inline-flex h-6 items-center gap-1 rounded px-2 text-[11.5px] font-medium transition-colors ${previewMode === "edit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      <MousePointer2 className="h-3.5 w-3.5" /> Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewMode("comment")}
                    title="Comment on any element"
                    className={`inline-flex h-6 items-center gap-1 rounded px-2 text-[11.5px] font-medium transition-colors ${previewMode === "comment" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" /> Comment
                    {openCount > 0 && (
                      <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[9.5px] font-semibold text-white">
                        {openCount}
                      </span>
                    )}
                  </button>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Draft preview
                </span>
              </div>

              {/* rendered page + overlays */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div ref={canvasRef} className="relative">
                  <div
                    className={cn("bcms-canvas bg-white text-slate-900", xray && "bcms-xray")}
                    style={VISION_FILTER[vision] ? { filter: VISION_FILTER[vision] } : undefined}
                  >
                    <SiteChrome />
                    {active.sections.map((s, i) => {
                      const def = getSectionDef(s.type);
                      if (!def) return null;
                      return (
                        <div key={s.id}>
                          {composing && <InsertPoint onClick={() => setLibraryAt(i)} />}
                          <SectionShell
                            section={s}
                            def={def}
                            composing={composing}
                            isFirst={i === 0}
                            isLast={i === active.sections.length - 1}
                            flash={flashId === s.id}
                            onMove={(d) => moveSection(s.id, d)}
                            onDuplicate={() => duplicateSection(s.id)}
                            onRemove={() => removeSection(s.id)}
                            onVariant={(v) => setSectionVariant(s.id, v)}
                          >
                            <SectionRenderer section={s} editable={previewMode === "edit"} onEdit={(k, v) => setField(s.id, k, v)} />
                          </SectionShell>
                        </div>
                      );
                    })}
                    {active.sections.length === 0 ? (
                      <div className="px-8 py-14 text-center">
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 px-6 py-14">
                          <LayoutTemplate className="mx-auto h-8 w-8 text-slate-300" />
                          <p className="mt-3 text-[14px] font-semibold text-slate-900">
                            {canBuild ? "Start with a section" : "No sections yet"}
                          </p>
                          <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-slate-500">
                            {canBuild
                              ? "Compose this page from sections your developers defined in code."
                              : "A marketer or developer adds sections here. You can edit the text once they do."}
                          </p>
                          {canBuild && (
                            <button
                              type="button"
                              onClick={() => setLibraryAt(0)}
                              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-indigo-700"
                            >
                              <Plus className="h-3.5 w-3.5" /> Browse sections
                            </button>
                          )}
                        </div>
                      </div>
                    ) : composing ? (
                      <div className="px-8 pb-8 pt-3">
                        <button
                          type="button"
                          onClick={() => setLibraryAt(active.sections.length)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-3.5 text-[12.5px] font-semibold text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                        >
                          <Plus className="h-4 w-4" /> Add section
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {showGrid && <ColumnGuides />}
                  {tier !== "mobile" && (
                    <PresenceCanvasLayer
                      peers={presencePeers}
                      pagePath={active.path}
                      containerRef={canvasRef}
                      recalcKey={recalc}
                    />
                  )}
                  <CommentLayer
                    containerRef={canvasRef}
                    threads={threads}
                    commentMode={previewMode === "comment"}
                    activeThreadId={openThread?.id ?? null}
                    onOpen={(id) => { setDraft(null); setOpenThread({ id, surface: "canvas" }); }}
                    onNew={(k, l) => startFieldComment(k, l, "canvas")}
                    recalcKey={recalc}
                  />
                </div>
              </div>
            </div>
            <p className="mx-auto mt-2.5 max-w-[1000px] text-[11.5px] text-muted-foreground">
              {previewMode === "edit"
                ? canBuild
                  ? "Click text to edit it inline. Hover between sections to add one, or use the section controls to arrange the page."
                  : "You are viewing as a Content editor. Edit text inline; page structure is managed by Marketers and Developers."
                : "Comment mode: select any text, or use the comment button on a field. Threads show in both Visual and Form modes."}
            </p>

            {/* select-to-comment button */}
            {sel && previewMode === "comment" && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={startSelComment}
                style={{ position: "fixed", top: sel.rect.top - 42, left: sel.rect.left + sel.rect.width / 2, transform: "translateX(-50%)", zIndex: 74 }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg transition-colors hover:bg-indigo-700"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" /> Comment
              </button>
            )}
          </div>
        )}

        {showComments && (
          <CommentsPanel
            threads={threads}
            activeId={openThread?.id ?? null}
            onOpen={openThreadById}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>

      <CommentStyles />

      {/* section library — marketer-facing browser of developer-defined sections */}
      <SectionLibrary open={libraryAt !== null} onClose={() => setLibraryAt(null)} onAdd={addSection} />

      {/* create-page template picker */}
      <TemplatePicker open={pagePicker} onClose={() => setPagePicker(false)} customTemplates={customTemplates} onPick={createFromTemplate} />

      {/* page settings + SEO for the active page */}
      {pageSettingsOpen && (
        <PageSettingsDialog
          projectId={projectId}
          page={active}
          staging={staging}
          onClose={() => setPageSettingsOpen(false)}
          onPathChange={(next) => setActivePath(next)}
        />
      )}

      {comparePageOpen && (
        <ComparePageDialog projectId={projectId} page={active} canEdit={canEdit} onClose={() => setComparePageOpen(false)} />
      )}

      {/* save current page as a template */}
      {tplName !== null && (
        <div className="fixed inset-0 z-[95]">
          <div className="absolute inset-0 bg-slate-900/45" onMouseDown={() => setTplName(null)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Save page as template"
            className="absolute left-1/2 top-[24vh] w-[min(400px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <LayoutTemplate className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[14px] font-semibold">Save page as template</div>
                <div className="text-[11.5px] text-slate-500">The current section stack becomes a reusable template.</div>
              </div>
            </div>
            <label htmlFor="tpl-name" className="mt-3 block text-[11.5px] font-medium text-slate-600">
              Template name
            </label>
            <input
              id="tpl-name"
              autoFocus
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tplName.trim()) saveAsTemplate(tplName.trim());
                if (e.key === "Escape") setTplName(null);
              }}
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2.5 text-[13px] outline-none transition-shadow focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-2 text-[11px] text-slate-500">
              Anyone with the Marketer or Developer role sees it under Create a page.
            </p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setTplName(null)} className="h-8 rounded-md px-3 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="button"
                disabled={!tplName.trim()}
                onClick={() => saveAsTemplate(tplName.trim())}
                className="h-8 rounded-md bg-indigo-600 px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* comment popovers — rendered at root so they work in both Visual and Form modes */}
      {activeThread && openThread && (
        <ThreadPopover
          thread={activeThread}
          getRect={() => fieldRect(openThread.surface, activeThread.fieldKey)}
          onClose={() => setOpenThread(null)}
          onReply={(b, i) => addReply(activeThread.id, b, i)}
          onReact={(mid, e) => reactMsg(activeThread.id, mid, e)}
          onDeleteMsg={(mid) => deleteMsg(activeThread.id, mid)}
          onEditMsg={(mid, b) => editMsg(activeThread.id, mid, b)}
          onResolve={() => resolveThread(activeThread.id)}
          onCopyLink={() => copyLink(activeThread.id)}
        />
      )}
      {draft && (
        <NewCommentPopover
          fieldLabel={draft.fieldLabel}
          quote={draft.quote}
          getRect={() => fieldRect(draft.surface, draft.fieldKey)}
          onSubmit={(b, i) => createThread(b, i)}
          onCancel={() => setDraft(null)}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[12px] font-medium text-foreground">{label}</div>
      {children}
    </label>
  );
}

/* Device viewport toggle — icon-only segmented control that resizes the preview frame. */
function DeviceBar({ device, onChange }: { device: Device; onChange: (d: Device) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] p-1">
      {(Object.keys(DEVICE_META) as Device[]).map((d) => {
        const m = DEVICE_META[d];
        const Icon = m.icon;
        const isActive = device === d;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            title={m.width ? `${m.label} · ${m.width}px` : m.label}
            aria-label={m.label}
            aria-pressed={isActive}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md transition-colors",
              isActive
                ? "bg-[color:var(--s2)] text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}

/* Filter/style defs used by the canvas accessibility previews. Mounted once. */
function CanvasDefs() {
  return (
    <>
      <style>{`.bcms-xray, .bcms-xray * { outline: 1px solid color-mix(in oklab, var(--primary) 42%, transparent) !important; outline-offset: -1px; }
::highlight(bcms-comment) { background-color: rgba(99, 102, 241, 0.28); color: inherit; }
.bcms-canvas a { color: #4f46e5; text-decoration: underline; text-underline-offset: 2px; cursor: text; }`}</style>
      <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
        <defs>
          {/* Deuteranopia (red-green) simulation matrix */}
          <filter id="bcms-deuteranopia">
            <feColorMatrix
              type="matrix"
              values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
    </>
  );
}

/* 12-column layout guide — a Figma-style grid to structure sections. Non-interactive. */
function ColumnGuides() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex gap-4 px-8" aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="h-full flex-1 rounded-[1px] bg-[color:color-mix(in_oklab,var(--primary)_7%,transparent)] ring-1 ring-inset ring-[color:color-mix(in_oklab,var(--primary)_14%,transparent)]"
        />
      ))}
    </div>
  );
}

/* Canvas settings — guides, X-ray, and accessibility vision preview. Kept intentionally small. */
function CanvasSettings({
  showGrid,
  onGrid,
  xray,
  onXray,
  vision,
  onVision,
}: {
  showGrid: boolean;
  onGrid: (v: boolean) => void;
  xray: boolean;
  onXray: (v: boolean) => void;
  vision: Vision;
  onVision: (v: Vision) => void;
}) {
  const [open, setOpen] = useState(false);
  const dirty = showGrid || xray || vision !== "none";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Canvas settings"
        aria-expanded={open}
        title="Canvas settings"
        className={cn(
          "grid h-9 w-9 place-items-center rounded-lg border transition-colors",
          dirty
            ? "border-[color:color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary"
            : "border-[color:var(--color-border)] bg-[color:var(--card)] text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground",
        )}
      >
        <Settings2 className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Canvas settings"
            className="absolute right-0 top-full z-50 mt-1.5 w-[268px] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-[var(--shadow-3)]"
          >
            <div className="border-b border-[color:var(--border-hairline)] px-3 py-2 text-[12px] font-semibold text-foreground">
              Canvas settings
            </div>
            <div className="space-y-0.5 p-1.5">
              <ToggleRow icon={Columns3} label="Column grid" hint="12-column layout guide" on={showGrid} onClick={() => onGrid(!showGrid)} />
              <ToggleRow icon={ScanLine} label="X-ray mode" hint="Outline every element" on={xray} onClick={() => onXray(!xray)} />
            </div>
            <div className="border-t border-[color:var(--border-hairline)] p-2.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Accessibility className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11.5px] font-semibold text-foreground">Vision preview</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {VISION_OPTIONS.map((o) => {
                  const isActive = vision === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onVision(o.id)}
                      aria-pressed={isActive}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-left text-[11.5px] font-medium transition-colors",
                        isActive
                          ? "bg-[color:var(--s2)] text-foreground ring-1 ring-[color:var(--color-border)]"
                          : "text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground",
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground">
                Preview how the page reads for low vision and color blindness. Affects the canvas only.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  hint,
  on,
  onClick,
}: {
  icon: typeof Columns3;
  label: string;
  hint: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--color-row-hover)]"
    >
      <Icon className={cn("h-4 w-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
      <span className="flex-1">
        <span className="block text-[12.5px] font-medium text-foreground">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <span className={cn("relative h-4 w-7 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-[color:var(--s3)]")}>
        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all", on ? "left-3.5" : "left-0.5")} />
      </span>
    </button>
  );
}

/* Dedicated, obvious page switcher that lives in the editor toolbar. */
function PageSelect({
  pages,
  activePath,
  onSelect,
  onCreate,
}: {
  pages: Page[];
  activePath: string;
  onSelect: (path: string) => void;
  /** Marketer and developer roles can create a page; omit to hide. */
  onCreate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const active = pages.find((p) => p.path === activePath) ?? pages[0];
  const query = q.trim().toLowerCase();
  const filtered = pages.filter(
    (p) => !query || p.path.toLowerCase().includes(query) || p.title.toLowerCase().includes(query),
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setQ("");
        }}
        aria-label="Switch page"
        title="Switch page"
        className="inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] pl-2 pr-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-row-hover)]"
      >
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{active.title}</span>
        <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:inline">
          {active.path}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-[var(--shadow-3)]">
            <div className="flex items-center gap-1.5 border-b border-[color:var(--border-hairline)] px-2.5 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && filtered[0]) {
                    onSelect(filtered[0].path);
                    setOpen(false);
                  }
                }}
                placeholder="Search pages…"
                className="flex-1 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-2 py-4 text-center text-[12px] text-muted-foreground">
                  No pages found
                </div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.path}
                    type="button"
                    onClick={() => {
                      onSelect(p.path);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                      p.path === activePath
                        ? "bg-[color:var(--color-row-hover)]"
                        : "hover:bg-[color:var(--color-row-hover)]"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-[12.5px] font-medium text-foreground">{p.title}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{p.path}</span>
                    {p.path === activePath && (
                      <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
            {onCreate && (
              <div className="border-t border-[color:var(--border-hairline)] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onCreate();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] font-medium text-primary transition-colors hover:bg-[color:var(--color-row-hover)]"
                >
                  <Plus className="h-3.5 w-3.5" /> New page
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* Global site chrome. Managed by the site settings, not a section, so it is not composable. */
function SiteChrome() {
  return (
    <div className="flex items-center justify-between px-8 py-4">
      <div className="flex items-center gap-2">
        <span className="h-5 w-5 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
        <span className="text-[13px] font-semibold">Acme</span>
      </div>
      <div className="hidden items-center gap-5 text-[12px] text-slate-500 sm:flex">
        <span>Product</span>
        <span>Docs</span>
        <span>Pricing</span>
        <span className="rounded-md bg-slate-900 px-2.5 py-1 text-[11.5px] font-medium text-white">Get started</span>
      </div>
    </div>
  );
}

/* Hover-revealed insertion point between sections. */
function InsertPoint({ onClick }: { onClick: () => void }) {
  return (
    <div className="group/ins relative z-20 -my-2 flex h-4 items-center justify-center opacity-0 transition-opacity duration-150 hover:opacity-100 focus-within:opacity-100">
      <div className="absolute inset-x-10 top-1/2 h-px -translate-y-1/2 bg-indigo-300" aria-hidden />
      <button
        type="button"
        onClick={onClick}
        aria-label="Add section here"
        className="relative z-10 inline-flex h-6 items-center gap-1 rounded-full border border-indigo-200 bg-white px-2.5 text-[11px] font-semibold text-indigo-600 shadow-sm transition-transform hover:scale-105"
      >
        <Plus className="h-3 w-3" /> Add section
      </button>
    </div>
  );
}

/*
 * SectionShell — wraps a rendered section on the canvas. For marketer and
 * developer roles it adds the composition chrome: a name chip, hover outline,
 * and controls to change layout, reorder, duplicate, and delete.
 */
function SectionShell({
  section,
  def,
  composing,
  isFirst,
  isLast,
  flash,
  onMove,
  onDuplicate,
  onRemove,
  onVariant,
  children,
}: {
  section: SectionInstance;
  def: SectionDef;
  composing: boolean;
  isFirst: boolean;
  isLast: boolean;
  flash: boolean;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onVariant: (variantId: string) => void;
  children: React.ReactNode;
}) {
  const [variantOpen, setVariantOpen] = useState(false);
  const variantName = def.variants.find((v) => v.id === section.variant)?.name;
  return (
    <section data-sec={section.id} className={cn("relative", composing && "group/sec", flash && "ring-2 ring-inset ring-indigo-400")}>
      {children}
      {composing && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10 hidden ring-1 ring-inset ring-indigo-300/70 group-hover/sec:block" aria-hidden />
          <div className="absolute left-3 top-2.5 z-20 hidden items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm group-hover/sec:flex">
            <def.icon className="h-3 w-3 text-indigo-500" /> {def.name}
            {def.variants.length > 1 && <span className="text-slate-400">· {variantName}</span>}
          </div>
          <div
            role="toolbar"
            aria-label={`${def.name} section controls`}
            className="absolute right-3 top-2.5 z-20 hidden items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm focus-within:flex group-hover/sec:flex"
          >
            {def.variants.length > 1 && (
              <div className="relative">
                <ShellBtn label="Change layout" onClick={() => setVariantOpen((v) => !v)}>
                  <Repeat2 className="h-3.5 w-3.5" />
                </ShellBtn>
                {variantOpen && (
                  <>
                    <div className="fixed inset-0 z-0" onMouseDown={() => setVariantOpen(false)} aria-hidden />
                    <div className="absolute right-0 top-8 z-10 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                      <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Layout</div>
                      {def.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            onVariant(v.id);
                            setVariantOpen(false);
                          }}
                          className="flex w-full items-center px-2.5 py-1.5 text-left text-[12px] text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          {v.name}
                          {v.id === section.variant && <Check className="ml-auto h-3.5 w-3.5 text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <ShellBtn label="Move up" disabled={isFirst} onClick={() => onMove(-1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </ShellBtn>
            <ShellBtn label="Move down" disabled={isLast} onClick={() => onMove(1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </ShellBtn>
            <ShellBtn label="Duplicate section" onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" />
            </ShellBtn>
            <ShellBtn label="Delete section" danger onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" />
            </ShellBtn>
          </div>
        </>
      )}
    </section>
  );
}

function ShellBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-6 w-6 place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30",
        danger ? "text-rose-500 hover:bg-rose-50" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
      )}
    >
      {children}
    </button>
  );
}
