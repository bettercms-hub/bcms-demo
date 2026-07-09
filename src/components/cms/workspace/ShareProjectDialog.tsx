/**
 * ShareProjectDialog — publish read-only preview and cloneable template
 * links for a project.
 *
 * - Read-only preview: a sandbox link to review the build (pages, model,
 *   content). No editing, no settings — safe to share internally.
 * - Template: the same sandbox plus a Clone button, which you can turn off
 *   to keep the template look-only.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, Eye, LayoutTemplate, Link2, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { shareActions, shareUrl, useShare, type ShareLink } from "@/lib/cms/share-store";
import { cn } from "@/lib/utils";

export function ShareProjectDialog({
  project,
  onClose,
}: {
  project: { id: string; name: string };
  onClose: () => void;
}) {
  const share = useShare(project.id);

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${project.name}`}
        className="absolute left-1/2 top-[8vh] flex max-h-[84vh] w-[min(520px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] text-foreground shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
            <Share2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Share project</div>
            <div className="truncate text-[11.5px] text-muted-foreground">{project.name}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {/* Read-only preview link */}
          <ShareCard
            icon={Eye}
            title="Read-only preview link"
            blurb="Anyone with the link can review the build: pages, content model and entries. No editing, no settings."
            on={!!share.preview}
            onToggle={(v) => {
              if (v) {
                shareActions.enablePreview(project.id);
                toast.success("Preview link created");
              } else {
                shareActions.disablePreview(project.id);
                toast("Preview link turned off");
              }
            }}
            link={share.preview}
            projectId={project.id}
            kind="preview"
          />

          {/* Template / clone link */}
          <ShareCard
            icon={LayoutTemplate}
            title="Template link"
            blurb="Share as a template. Visitors preview it, and can clone it into their own workspace unless you turn cloning off."
            on={!!share.template}
            onToggle={(v) => {
              if (v) {
                shareActions.enableTemplate(project.id);
                toast.success("Template link created");
              } else {
                shareActions.disableTemplate(project.id);
                toast("Template link turned off");
              }
            }}
            link={share.template}
            projectId={project.id}
            kind="template"
          >
            {share.template && (
              <label className="mt-2 flex cursor-pointer items-center justify-between rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-3 py-2.5">
                <span>
                  <span className="block text-[12.5px] font-medium">Allow cloning</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {share.template.cloneEnabled ? "The Clone button is shown to visitors." : "Preview only. The Clone button is hidden."}
                  </span>
                </span>
                <Switch
                  checked={share.template.cloneEnabled}
                  onCheckedChange={(v) => shareActions.setCloneEnabled(project.id, v)}
                  aria-label="Allow cloning"
                />
              </label>
            )}
          </ShareCard>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
          <span className="text-[11px] text-muted-foreground">Links are unlisted and not indexed by search engines.</span>
          <button type="button" onClick={onClose} className="h-8 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]">
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ShareCard({
  icon: Icon,
  title,
  blurb,
  on,
  onToggle,
  link,
  projectId,
  kind,
  children,
}: {
  icon: typeof Eye;
  title: string;
  blurb: string;
  on: boolean;
  onToggle: (v: boolean) => void;
  link?: ShareLink;
  projectId: string;
  kind: "preview" | "template";
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const url = link ? shareUrl(link.token) : "";

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={cn("rounded-xl border p-3.5 transition-colors", on ? "border-[color:var(--color-border)]" : "border-[color:var(--border-hairline)]")}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", on ? "bg-[color:color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary" : "bg-[color:var(--s2)] text-muted-foreground")}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold">{title}</div>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{blurb}</p>
        </div>
        <Switch checked={on} onCheckedChange={onToggle} aria-label={title} />
      </div>

      {on && link && (
        <>
          <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-2.5 py-1.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-muted-foreground">{url.replace(/^https?:\/\//, "")}</span>
            <button type="button" onClick={copy} aria-label="Copy link" className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open link" className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="mt-1.5 px-0.5">
            <span className="text-[10.5px] tabular-nums text-muted-foreground">{link.views} {link.views === 1 ? "view" : "views"}</span>
          </div>
          {children}
        </>
      )}
    </div>
  );
}
