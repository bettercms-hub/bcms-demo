import { ExternalLink, Rocket, Sparkles } from "lucide-react";
import { ProjectNav } from "./ProjectNav";
import { editorBus } from "@/lib/cms/editor-bus";
import { useCurrentPageStatus } from "@/lib/cms/editor/use-current-page-status";
import { formatRelative } from "@/lib/cms/format-time";
import { agentDock, useAgentDock } from "@/lib/agent/dock-store";
import { canEditContent, canPublish as roleCanPublish, useEffectiveRole } from "@/lib/workspace/my-role";
import { useViewportTier } from "@/lib/device";

type Scope = "pages" | "collections" | "components";

interface Props {
  wsSlug: string;
  projectSlug: string;
  pathname: string;
  scope?: Scope;
  view?: "pages" | "content";
}

const STATUS_TONE: Record<string, { dot: string; text: string; label: string }> = {
  draft:     { dot: "bg-muted-foreground/60", text: "text-muted-foreground",         label: "Draft" },
  review:    { dot: "bg-amber-400",            text: "text-amber-500",                label: "In review" },
  approved:  { dot: "bg-sky-400",              text: "text-sky-500",                  label: "Approved" },
  scheduled: { dot: "bg-amber-400",            text: "text-amber-500",                label: "Scheduled" },
  published: { dot: "bg-emerald-400",          text: "text-emerald-500",              label: "Published" },
  archived:  { dot: "bg-muted-foreground/40",  text: "text-muted-foreground/70",      label: "Archived" },
  unsaved:   { dot: "bg-primary",              text: "text-primary",                  label: "Unsaved changes" },
};

/**
 * Slim project header — tabs on the left, single-source status pill and the
 * one and only Publish action on the right. The editor toolbar no longer
 * carries its own Publish or save chip; both flow through this header.
 */
export function ProjectHeader({ wsSlug, projectSlug, pathname, scope, view }: Props) {
  const status = useCurrentPageStatus();
  const inEditor = pathname.includes("/editor");
  const tone = STATUS_TONE[status.state] ?? STATUS_TONE.draft;
  const { effective } = useEffectiveRole(wsSlug);
  // The dock itself is tier-gated in AppShell, so its toggle follows the
  // same rule (a CSS breakpoint would leave a dead button on landscape phones).
  const tier = useViewportTier();
  // Publishing is per-page: the visual editor and the Pages list each carry
  // their own PublishMenu, and collection entries publish from the editor
  // toolbar. The generic header Publish only makes sense when editing pages
  // in the structured editor; everywhere else it would double up.
  const publishAllowed = roleCanPublish(effective) && pathname.includes("/editor") && scope !== "collections";
  const canPublish = Boolean(status.pageId);
  // On collection surfaces the "current page" resolves to an unrelated first
  // page, so the status pill would show a wrong, confusing state. Entries and
  // collections carry their own status in the editor toolbar instead.
  const showStatusPill = inEditor && status.page && scope !== "collections";

  return (
    <div className="flex h-12 shrink-0 items-center border-b border-border bg-[color:var(--topbar)] pl-1 pr-3">
      {/* Tabs */}
      <div className="min-w-0 shrink">
        <ProjectNav
          wsSlug={wsSlug}
          projectSlug={projectSlug}
          pathname={pathname}
          scope={scope}
          view={view}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {showStatusPill && (
          <>
            <span
              className="hidden items-center gap-1.5 px-1.5 text-[11.5px] font-medium md:inline-flex"
              title={
                status.lastEditedAt
                  ? `${tone.label} · ${new Date(status.lastEditedAt).toLocaleString()}`
                  : tone.label
              }
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
              <span className={tone.text}>{tone.label}</span>
              {status.lastEditedAt && (
                <span className="text-muted-foreground/70">
                  · {formatRelative(status.lastEditedAt)}
                </span>
              )}
            </span>
            <div className="mx-1 hidden h-4 w-px shrink-0 bg-border md:block" aria-hidden />
          </>
        )}
        {canEditContent(effective) && !pathname.endsWith("/agent") && tier !== "mobile" && <AgentDockButton />}
        <button
          type="button"
          aria-label="View site"
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="hidden sm:inline">View site</span>
        </button>
        {publishAllowed && (
          <>
            <div className="mx-1 hidden h-4 w-px shrink-0 bg-border md:block" aria-hidden />
            <button
              type="button"
              data-testid="global-publish"
              onClick={() => editorBus.emit({ type: "editor:request-publish" })}
              disabled={!canPublish}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Rocket className="h-3.5 w-3.5" strokeWidth={2} />
              Publish
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Toggles the agent side panel. Lit while the dock is open. */
function AgentDockButton() {
  const { open } = useAgentDock();
  return (
    <button
      type="button"
      data-agent-dock-toggle
      onClick={() => agentDock.toggle()}
      aria-pressed={open}
      title="Agent"
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] transition-colors ${
        open
          ? "bg-[color:color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary"
          : "text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
      }`}
    >
      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
      Agent
    </button>
  );
}
