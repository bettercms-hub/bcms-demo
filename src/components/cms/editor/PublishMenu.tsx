/**
 * PublishMenu — the single publishing surface for a page, used by both the
 * visual editor header and the Pages list. Choose the destination (private
 * Staging or live Production), publish now or schedule, copy the private
 * preview link, and manage the page's lifecycle. Self-contained: it writes to
 * the pages store directly so every caller behaves identically.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Globe,
  LayoutTemplate,
  Lock,
  Rocket,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { pagesActions, type PageDoc, type PageState } from "@/lib/cms/pages-store";

const TONE: Record<PageState, { label: string; dot: string; text: string }> = {
  draft: { label: "Draft", dot: "bg-muted-foreground/60", text: "text-muted-foreground" },
  published: { label: "Published", dot: "bg-emerald-400", text: "text-emerald-500" },
  modified: { label: "Unpublished changes", dot: "bg-amber-400", text: "text-amber-500" },
  scheduled: { label: "Scheduled", dot: "bg-sky-400", text: "text-sky-500" },
  archived: { label: "Archived", dot: "bg-muted-foreground/40", text: "text-muted-foreground/70" },
};

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function toLocalInput(iso?: string) {
  const base = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
}

/** A popover version anchored to a trigger; the caller wraps it in a relative element. */
export function PublishMenu({
  projectId,
  page,
  staging,
  domain,
  onClose,
  onSaveTemplate,
  align = "right",
  portal = false,
  rect,
}: {
  projectId: string;
  page: PageDoc;
  staging: string;
  domain?: string;
  onClose: () => void;
  onSaveTemplate?: () => void;
  align?: "left" | "right";
  /** Render into a fixed-position portal at `rect` instead of an absolute popover. */
  portal?: boolean;
  rect?: { top: number; left: number };
}) {
  const [dest, setDest] = useState<"staging" | "production">(page.state === "published" || page.state === "modified" ? "production" : "staging");
  const [when, setWhen] = useState<"now" | "later">(page.state === "scheduled" ? "later" : "now");
  const [dt, setDt] = useState(() => toLocalInput(page.scheduledAt));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const suffix = page.path === "/" ? "" : page.path;
  const stagingUrl = `${staging}${suffix}`;
  const liveUrl = `${domain ?? staging}${suffix}`;
  const tone = TONE[page.state];
  const isLive = page.state === "published" || page.state === "modified";

  const patch = (p: (d: PageDoc) => PageDoc) => pagesActions.update(projectId, page.path, p);

  function pushStaging() {
    patch((p) => ({ ...p, staged: true }));
    toast.success(`“${page.title}” pushed to private staging`);
    onClose();
  }
  function publishNow() {
    pagesActions.publish(projectId, page.path);
    toast.success(`“${page.title}” is live at ${domain ?? staging}`);
    onClose();
  }
  function schedule() {
    pagesActions.publish(projectId, page.path, { scheduledAt: new Date(dt).toISOString() });
    toast.success(`“${page.title}” scheduled for ${fmtWhen(new Date(dt).toISOString())}`);
    onClose();
  }
  function unpublish() {
    patch((p) => ({ ...p, state: "draft", scheduledAt: undefined }));
    toast.success(`“${page.title}” unpublished. It is no longer live.`);
    onClose();
  }
  function archive() {
    patch((p) => ({ ...p, state: "archived" }));
    toast.success(`“${page.title}” archived`);
    onClose();
  }

  const body = (
    <div
      role="dialog"
      aria-label="Publish page"
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "w-[350px] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-[var(--shadow-3)]",
        !portal && "absolute top-full z-50 mt-1.5",
        !portal && (align === "right" ? "right-0" : "left-0"),
      )}
      style={portal ? { position: "fixed", top: rect?.top ?? 0, left: rect?.left ?? 0, zIndex: 80 } : undefined}
    >
      <div className="border-b border-[color:var(--border-hairline)] px-4 py-3">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Rocket className="h-3.5 w-3.5 text-primary" /> Publish
          <span className="truncate font-normal text-muted-foreground">· {page.title}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            <span className={tone.text}>{tone.label}</span>
            {page.state === "scheduled" && page.scheduledAt && <span className="text-muted-foreground">for {fmtWhen(page.scheduledAt)}</span>}
          </span>
          {page.staged && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--s2)] px-1.5 text-[10.5px] font-medium text-muted-foreground">
              <ShieldCheck className="h-2.5 w-2.5" /> On staging
            </span>
          )}
        </div>
      </div>

      {/* destination */}
      <div className="px-4 pt-3">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Publish to</div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <DestOption icon={ShieldCheck} label="Staging" hint="Private preview" active={dest === "staging"} onClick={() => setDest("staging")} />
          <DestOption icon={Globe} label="Production" hint="Live site" active={dest === "production"} onClick={() => setDest("production")} />
        </div>
      </div>

      {/* preview link */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--s2)] px-2 py-1.5">
          <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-[11.5px] text-foreground">{stagingUrl}</span>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(`https://${stagingUrl}`).catch(() => {}); toast.success("Preview link copied"); }} title="Copy link" className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => window.open(`https://${stagingUrl}`, "_blank")} title="Open" className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Private link. Only workspace members can open it.</p>
      </div>

      {/* when (production only) */}
      {dest === "production" && (
        <div className="px-4 pt-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">When</div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <WhenOption icon={Rocket} label="Publish now" active={when === "now"} onClick={() => setWhen("now")} />
            <WhenOption icon={CalendarClock} label="Schedule" active={when === "later"} onClick={() => setWhen("later")} />
          </div>
          {when === "later" && (
            <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[12.5px] text-foreground outline-none transition-colors focus:border-[color:var(--primary)]" />
          )}
        </div>
      )}

      <div className="mx-4 mt-3 flex items-center gap-1.5 rounded-md bg-[color:var(--s2)] px-2.5 py-2 text-[11.5px] text-muted-foreground">
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <span>
          {dest === "staging" ? "Stays private at" : "Goes live at"} <span className="font-medium text-foreground">{dest === "staging" ? stagingUrl : liveUrl}</span>
        </span>
      </div>

      <div className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={onClose} className="h-8 rounded-md px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)]">
          Cancel
        </button>
        <button
          type="button"
          onClick={dest === "staging" ? pushStaging : when === "later" ? schedule : publishNow}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
        >
          {dest === "staging" ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5" /> Push to staging
            </>
          ) : when === "later" ? (
            <>
              <CalendarClock className="h-3.5 w-3.5" /> Schedule
            </>
          ) : (
            <>
              <Rocket className="h-3.5 w-3.5" /> Publish now
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[color:var(--border-hairline)] px-4 py-2.5 text-[11.5px]">
        {(isLive || page.state === "scheduled") && (
          <button type="button" onClick={unpublish} className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-3 w-3" /> {page.state === "scheduled" ? "Unschedule" : "Unpublish"}
          </button>
        )}
        {onSaveTemplate && (
          <button type="button" onClick={onSaveTemplate} className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
            <LayoutTemplate className="h-3 w-3" /> Save as template
          </button>
        )}
        <button type="button" onClick={archive} className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-rose-500">
          <Archive className="h-3 w-3" /> Archive
        </button>
      </div>
    </div>
  );

  if (!portal) {
    return (
      <>
        <div className="fixed inset-0 z-40" onMouseDown={onClose} aria-hidden />
        {body}
      </>
    );
  }
  return createPortal(
    <>
      <div className="fixed inset-0 z-[70]" onMouseDown={onClose} aria-hidden />
      {body}
    </>,
    document.body,
  );
}

function DestOption({ icon: Icon, label, hint, active, onClick }: { icon: typeof Globe; label: string; hint: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start rounded-md border px-2.5 py-1.5 text-left transition-colors",
        active
          ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)]"
          : "border-[color:var(--color-border)] hover:bg-[color:var(--color-row-hover)]",
      )}
    >
      <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", active ? "text-primary" : "text-foreground")}>
        <Icon className="h-3.5 w-3.5" /> {label}
        {active && <Check className="h-3 w-3" />}
      </span>
      <span className="mt-0.5 text-[10.5px] text-muted-foreground">{hint}</span>
    </button>
  );
}

function WhenOption({ icon: Icon, label, active, onClick }: { icon: typeof Globe; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border text-[12px] font-medium transition-colors",
        active
          ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary"
          : "border-[color:var(--color-border)] text-muted-foreground hover:bg-[color:var(--color-row-hover)]",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
