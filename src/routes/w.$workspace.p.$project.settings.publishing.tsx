import { createFileRoute } from "@tanstack/react-router";
import { Copy, ExternalLink, Plus, RotateCw, Trash2 } from "lucide-react";
import { PageHeader, SettingsSection, SettingsRow, StatusDot } from "@/components/cms/SettingsSubNav";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useCMS, select } from "@/lib/cms/store";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/publishing")({
  component: Publishing,
});

const HOOKS = [
  { id: "h1", name: "Production build", url: "https://api.bettercms.site/build/prod/abcd1234" },
  { id: "h2", name: "Staging build", url: "https://api.bettercms.site/build/stg/efgh5678" },
];

function envTone(status?: string): "success" | "warning" | "danger" | "muted" {
  if (status === "failed") return "danger";
  if (status === "building") return "warning";
  if (!status || status === "ready") return "success";
  return "muted";
}

function Publishing() {
  const { workspace, project } = Route.useParams();
  const pr = select.projectBySlug(workspace, project)!;
  const environments = useCMS((s) => s.siteEnvironments.filter((e) => e.projectId === pr.id));

  return (
    <>
      <PageHeader title="Publishing" description="How and when content goes live, and where it's deployed." />

      <SettingsSection title="Workflow" description="Rules that run when content is published.">
        <SettingsRow label="Require review" description="Content must be approved before it can be published.">
          <Switch defaultChecked />
        </SettingsRow>
        <SettingsRow label="Scheduled publishing" description="Allow editors to schedule pages for a future time.">
          <Switch defaultChecked />
        </SettingsRow>
        <SettingsRow label="Auto-deploy on publish" description="Trigger a production deploy whenever a page is published.">
          <Switch defaultChecked />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Environments" description="Where this site is published.">
        <div className="-mx-5 grid grid-cols-1 gap-3 px-5 pb-1 pt-1 md:grid-cols-3">
          {environments.length === 0 && (
            <div className="col-span-full py-6 text-center text-[13px] text-muted-foreground">
              No environments configured.
            </div>
          )}
          {environments.map((e) => (
            <div key={e.id} className="rounded-md border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot tone={envTone(e.status)} />
                  <span className="text-[13px] font-semibold capitalize text-foreground">{e.kind}</span>
                </div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {e.status ?? "ready"}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-[12px]">
                <div className="truncate font-mono text-muted-foreground" title={e.url}>{e.url}</div>
                <div className="text-muted-foreground">
                  Branch <span className="text-foreground">main</span>
                </div>
                {e.lastDeployAt && (
                  <div className="text-muted-foreground">
                    Last deploy{" "}
                    <span className="text-foreground">
                      {new Date(e.lastDeployAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-[12px]">
                  <a href={e.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-[12px]">
                  <Copy className="h-3 w-3" /> Copy
                </Button>
                <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-[12px]">
                  <RotateCw className="h-3 w-3" /> Deploy
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Build hooks"
        description="POST to a hook URL from external systems to trigger a build."
        action={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New hook
          </Button>
        }
      >
        {HOOKS.map((h) => (
          <SettingsRow key={h.id} label={h.name}>
            <div className="flex items-center gap-2">
              <Input readOnly value={h.url} className="w-[360px] font-mono text-[12px]" />
              <Button variant="outline" size="icon" className="h-9 w-9" title="Copy">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" title="Regenerate">
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-rose-500" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </SettingsRow>
        ))}
      </SettingsSection>
    </>
  );
}
