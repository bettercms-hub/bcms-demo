/**
 * AddDomainDialog — connect a custom domain to a project.
 *
 * Domains belong to projects, so this always resolves to one. From a project
 * page the project is fixed; from the workspace roll-up you pick which project
 * it is for. On add it writes to the domains store and hands the new domain's
 * project back so the caller can route you into that project's setup.
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Globe, X } from "lucide-react";
import { domainActions, useCMS } from "@/lib/cms/store";
import { Button } from "@/components/ui/button";

/** "https://Www.Acme.com/" -> "www.acme.com". */
function normalizeHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\s+/g, "");
}

const HOST_RE = /^(?=.{1,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/;

export function AddDomainDialog({
  workspaceId,
  fixedProjectId,
  onClose,
  onAdded,
}: {
  workspaceId: string;
  /** When set, the project is not selectable — used from a project page. */
  fixedProjectId?: string;
  onClose: () => void;
  onAdded?: (projectId: string, domainId: string) => void;
}) {
  const projects = useCMS((s) => s.projects.filter((p) => p.workspaceId === workspaceId));
  const existing = useCMS((s) => s.domains);

  const [projectId, setProjectId] = useState(fixedProjectId ?? projects[0]?.id ?? "");
  const [host, setHost] = useState("");

  const clean = normalizeHost(host);
  const dupe = useMemo(() => existing.some((d) => d.host === clean), [existing, clean]);
  const valid = HOST_RE.test(clean) && !dupe && projectId !== "";

  function submit() {
    if (!valid) return;
    const id = domainActions.add(workspaceId, projectId, clean);
    onAdded?.(projectId, id);
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add domain"
        className="absolute left-1/2 top-[12vh] w-[min(480px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:color-mix(in_oklab,var(--primary)_9%,transparent)] text-primary">
            <Globe className="h-4 w-4" />
          </span>
          <div className="flex-1 text-[14px] font-semibold text-foreground">Add a domain</div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5 p-4">
          {!fixedProjectId && (
            <label className="block">
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Project</div>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-card px-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-[color:var(--primary)]"
              >
                {projects.length === 0 && <option value="">No projects yet</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-muted-foreground">Domains are verified and served per project.</div>
            </label>
          )}

          <label className="block">
            <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Domain</div>
            <div className="flex items-center rounded-lg border border-[color:var(--color-border)] bg-card px-2.5 focus-within:border-[color:var(--primary)]">
              <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                autoFocus
                placeholder="www.yourbrand.com"
                className="h-9 w-full bg-transparent px-2 font-mono text-[13px] outline-none"
              />
            </div>
            {dupe ? (
              <div className="mt-1 text-[11px] text-rose-500">{clean} is already connected.</div>
            ) : (
              <div className="mt-1 text-[11px] text-muted-foreground">Enter an apex domain or subdomain. You will add DNS records next.</div>
            )}
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={submit}>Add domain</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
