import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Globe, MoreHorizontal, Plus, Search, ShieldCheck, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SettingsSection, StatusDot } from "@/components/cms/SettingsSubNav";
import { LockedFeature } from "@/components/cms/billing/FeatureGate";
import { AddDomainDialog } from "@/components/cms/domains/AddDomainDialog";
import { siteHas } from "@/lib/billing/pricing";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { domainActions, useCMS } from "@/lib/cms/store";
import type { Domain } from "@/lib/cms/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/domains")({
  component: Domains,
});

function sslMeta(status: Domain["sslStatus"]) {
  if (status === "issued") return { label: "SSL issued", cls: "text-emerald-500" };
  if (status === "pending") return { label: "SSL pending", cls: "text-amber-500" };
  if (status === "failed") return { label: "SSL failed", cls: "text-rose-500" };
  return { label: "No SSL", cls: "text-muted-foreground" };
}

function Domains() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project);
  const plan = pr?.sitePlan ?? "free";

  // Real domains for this project, from the same store the workspace roll-up reads.
  const domains = useCMS((s) => (pr ? s.domains.filter((d) => d.projectId === pr.id) : []));
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const primary = domains.find((d) => d.primary);
  const others = useMemo(
    () => domains.filter((d) => !d.primary && (!q || d.host.toLowerCase().includes(q.toLowerCase()))),
    [domains, q],
  );

  // Preview URLs are always available and not stored as custom domains.
  const previews = pr ? [`${pr.slug}.bettercms.site`, `staging.${pr.slug}.bettercms.site`] : [];

  if (!siteHas(plan, "custom-domain")) {
    return (
      <LockedFeature
        featureKey="custom-domain"
        title="Custom domain and SSL"
        blurb="Point your own domain at this site with automatic SSL."
        wsSlug={workspace}
      />
    );
  }

  function makePrimary(d: Domain) {
    domainActions.setPrimary(d.id);
    toast.success(`${d.host} is now the primary domain`);
  }
  function remove(d: Domain) {
    domainActions.remove(d.id);
    toast.success(`${d.host} removed`);
  }

  return (
    <>
      <PageHeader
        title="Domains"
        description="Connect custom domains, verify ownership, and manage SSL for this project."
        action={
          <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add domain
          </Button>
        }
      />

      <SettingsSection title="Primary domain" description="The canonical URL for this site. All traffic redirects here.">
        {primary ? (
          <div className="flex items-center justify-between py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-foreground">{primary.host}</span>
                <Badge variant="outline" className="text-[10px]">Primary</Badge>
                <StatusDot tone={primary.sslStatus === "issued" ? "success" : "warning"} />
                <span className={`text-[11px] uppercase tracking-wider ${sslMeta(primary.sslStatus).cls}`}>{sslMeta(primary.sslStatus).label}</span>
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">Change the primary from any verified custom domain below.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
              <a href={`https://${primary.host}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3" /> Open
              </a>
            </Button>
          </div>
        ) : (
          <div className="py-4 text-[12.5px] text-muted-foreground">
            No primary domain yet. Add a custom domain, then set it as primary. Your site stays live on{" "}
            <span className="font-mono text-foreground">{previews[0]}</span>.
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Custom domains" description="Domains pointing to this project." flush>
        <div className="flex items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-2.5">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search domains" className="h-8 pl-8 text-[12px]" />
          </div>
          <span className="ml-auto text-[12px] text-muted-foreground">{others.length} domain{others.length === 1 ? "" : "s"}</span>
        </div>

        {others.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            {q ? "No domains match your search." : "No secondary domains. Add one to point more traffic at this project."}
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border-hairline)]">
            {others.map((d) => {
              const ssl = sslMeta(d.sslStatus);
              const verified = d.status === "active";
              return (
                <li key={d.id} className="group flex items-center gap-3 px-4 py-3">
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">{d.host}</span>
                  <span className="inline-flex w-[110px] items-center gap-1.5 text-[12px]">
                    <StatusDot tone={verified ? "success" : "warning"} />
                    {verified ? "Verified" : "Verifying"}
                  </span>
                  <span className="inline-flex w-[110px] items-center gap-1.5 text-[12px]">
                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className={ssl.cls}>{d.sslStatus ?? "none"}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Open">
                      <a href={`https://${d.host}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" aria-label={`Actions for ${d.host}`} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground data-[state=open]:bg-[color:var(--color-row-hover)]">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[190px]">
                        <DropdownMenuItem className="text-[13px]" disabled={!verified} onSelect={() => makePrimary(d)}>
                          <Star className="mr-2 h-3.5 w-3.5" /> Set as primary
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[13px]" onSelect={() => { navigator.clipboard.writeText(d.host); toast.success("Domain copied"); }}>
                          <Copy className="mr-2 h-3.5 w-3.5" /> Copy domain
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-[13px] text-destructive focus:text-destructive" onSelect={() => remove(d)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection title="Preview domains" description="Auto-generated URLs for previews and staging. Always on, no setup." flush>
        <ul className="divide-y divide-[color:var(--border-hairline)]">
          {previews.map((host) => (
            <li key={host} className="flex items-center gap-3 px-4 py-3">
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">{host}</span>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-500">
                <Check className="h-3.5 w-3.5" /> Live
              </span>
              <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Open">
                <a href={`https://${host}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
              </Button>
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection title="DNS instructions" description="Add these records at your registrar to verify a new domain.">
        <div className="space-y-3 py-4">
          <DnsRow type="A" name="@" value="76.76.21.21" />
          <DnsRow type="CNAME" name="www" value="cname.bettercms.site" />
          <DnsRow type="TXT" name="_bettercms" value="verify=abcd1234efgh5678" />
        </div>
      </SettingsSection>

      {adding && pr && <AddDomainDialog workspaceId={pr.workspaceId} fixedProjectId={pr.id} onClose={() => setAdding(false)} onAdded={() => toast.success("Domain added. Follow the DNS steps to verify.")} />}
    </>
  );
}

function DnsRow({ type, name, value }: { type: string; name: string; value: string }) {
  return (
    <div className="grid grid-cols-[60px_120px_1fr_auto] items-center gap-3">
      <Badge variant="outline" className="justify-center font-mono text-[10px]">{type}</Badge>
      <Input readOnly value={name} className="font-mono" />
      <Input readOnly value={value} className="font-mono" />
      <Button variant="outline" size="icon" className="h-9 w-9" title="Copy" onClick={() => { navigator.clipboard.writeText(value); toast.success("Value copied"); }}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
