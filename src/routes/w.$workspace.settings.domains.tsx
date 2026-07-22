import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Globe, Plus } from "lucide-react";
import { SettingsHeader } from "@/components/cms/SettingsSubNav";
import { StatusBadge, DomainStatusBadge } from "@/components/cms/ui/StatusBadge";
import { AddDomainDialog } from "@/components/cms/domains/AddDomainDialog";
import { Button } from "@/components/ui/button";
import { useCMS } from "@/lib/cms/store";
import type { Domain } from "@/lib/cms/types";

export const Route = createFileRoute("/w/$workspace/settings/domains")({
  component: Domains,
});

function sslBadge(status: Domain["sslStatus"]) {
  const tone = status === "issued" ? "success" : status === "pending" ? "warning" : status === "failed" ? "danger" : "muted";
  return <StatusBadge label={status ?? "none"} tone={tone} />;
}

function Domains() {
  const { workspace: slug } = Route.useParams();
  const navigate = useNavigate();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const domains = useCMS((s) => (ws ? s.domains.filter((d) => d.workspaceId === ws.id) : []));
  const projects = useCMS((s) => s.projects);
  const [adding, setAdding] = useState(false);

  if (!ws) {
    return <SettingsHeader title="Domains" description="Custom domains linked to this workspace." />;
  }

  // Group by the project that owns each domain — domains are a project concern.
  const byProject = new Map<string, Domain[]>();
  for (const d of domains) {
    const key = d.projectId ?? "__none";
    byProject.set(key, [...(byProject.get(key) ?? []), d]);
  }
  const groups = [...byProject.entries()]
    .map(([projectId, list]) => ({
      project: projects.find((p) => p.id === projectId),
      list: list.sort((a, b) => (a.primary ? -1 : b.primary ? 1 : 0)),
    }))
    .sort((a, b) => (a.project?.name ?? "").localeCompare(b.project?.name ?? ""));

  const goToProject = (projectSlug: string) =>
    navigate({ to: "/w/$workspace/p/$project/settings/domains", params: { workspace: slug, project: projectSlug } });

  return (
    <>
      <SettingsHeader
        title="Domains"
        description="Every custom domain across this workspace. Domains are set up and verified inside each project."
        action={
          <Button size="sm" className="h-8 text-[13px]" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add domain
          </Button>
        }
      />

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--s2)] p-12 text-center">
          <Globe className="mx-auto h-7 w-7 text-muted-foreground/70" strokeWidth={1.5} />
          <h3 className="mt-3 text-[15px] font-semibold text-foreground">No domains yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
            Connect a domain to publish a project under your own brand. Pick the project, add the domain, then follow the DNS steps.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add domain
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ project, list }) => (
            <div key={project?.id ?? "none"} className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
              <div className="flex items-center gap-3 border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-foreground">{project?.name ?? "Unassigned"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {list.length} domain{list.length === 1 ? "" : "s"}
                  </div>
                </div>
                {project && (
                  <Button size="sm" variant="outline" className="h-7 text-[12px]" onClick={() => goToProject(project.slug)}>
                    Manage <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="grid h-10 grid-cols-[minmax(0,1fr)_110px_110px_100px] items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 text-[12.5px] font-medium text-muted-foreground">
                <span>Domain</span>
                <span>Status</span>
                <span>SSL</span>
                <span className="text-right">Added</span>
              </div>
              <ul className="divide-y divide-[color:var(--border-hairline)]">
                {list.map((d) => (
                  <li
                    key={d.id}
                    className="grid h-12 cursor-pointer grid-cols-[minmax(0,1fr)_110px_110px_100px] items-center gap-3 px-4 transition-colors hover:bg-[color:var(--row-hover)]"
                    onClick={() => project && goToProject(project.slug)}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <span className="truncate font-medium text-foreground">{d.host}</span>
                      {d.primary && <StatusBadge label="Primary" tone="info" />}
                    </div>
                    <span className="flex"><DomainStatusBadge status={d.status} /></span>
                    <span className="flex">{sslBadge(d.sslStatus)}</span>
                    <span className="text-right text-[12px] text-muted-foreground">{new Date(d.addedAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddDomainDialog
          workspaceId={ws.id}
          onClose={() => setAdding(false)}
          onAdded={(projectId) => {
            const p = projects.find((x) => x.id === projectId);
            if (p) goToProject(p.slug);
          }}
        />
      )}
    </>
  );
}
