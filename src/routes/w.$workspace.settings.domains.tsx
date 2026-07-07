import { createFileRoute } from "@tanstack/react-router";
import { Globe, Plus } from "lucide-react";
import { SettingsHeader, SettingsSection } from "@/components/cms/SettingsSubNav";
import { DataTable } from "@/components/cms/ui/DataTable";
import { StatusBadge, DomainStatusBadge } from "@/components/cms/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { useCMS } from "@/lib/cms/store";
import type { Domain } from "@/lib/cms/types";
import { toast } from "sonner";

export const Route = createFileRoute("/w/$workspace/settings/domains")({
  component: Domains,
});

function sslBadge(status: Domain["sslStatus"]) {
  const tone = status === "issued" ? "success" : status === "pending" ? "warning" : status === "failed" ? "danger" : "muted";
  return <StatusBadge label={status ?? "—"} tone={tone} />;
}

function Domains() {
  const { workspace: slug } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const domains = useCMS((s) => (ws ? s.domains.filter((d) => d.workspaceId === ws.id) : []));
  const projects = useCMS((s) => s.projects);
  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name ?? "—";

  if (!ws) {
    return <SettingsHeader title="Domains" description="Custom domains linked to this workspace." />;
  }

  return (
    <>
      <SettingsHeader
        title="Domains"
        description="Custom domains linked across the projects in this workspace."
        action={
          <Button size="sm" className="h-8 text-[13px]" onClick={() => toast("Adding a domain is coming soon")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add domain
          </Button>
        }
      />

      <SettingsSection
        title="Linked domains"
        description={`${domains.length} domain${domains.length === 1 ? "" : "s"} connected.`}
        flush
      >
        <DataTable
          rows={domains}
          rowKey={(d) => d.id}
          columns={[
            {
              key: "host",
              header: "Domain",
              cell: (d) => (
                <div className="flex items-center gap-2.5">
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <span className="font-medium text-foreground">{d.host}</span>
                  {d.primary && <StatusBadge label="Primary" tone="info" />}
                </div>
              ),
            },
            { key: "project", header: "Project", cell: (d) => <span className="text-muted-foreground">{projectName(d.projectId)}</span> },
            { key: "status", header: "Status", cell: (d) => <DomainStatusBadge status={d.status} /> },
            { key: "ssl", header: "SSL", cell: (d) => sslBadge(d.sslStatus) },
            {
              key: "added",
              header: "Added",
              align: "right",
              cell: (d) => <span className="text-muted-foreground">{new Date(d.addedAt).toLocaleDateString()}</span>,
            },
          ]}
          empty="No domains linked yet. Add one to publish under your own brand."
        />
      </SettingsSection>
    </>
  );
}
