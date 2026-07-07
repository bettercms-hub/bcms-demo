import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader, SettingsSection, StatusDot } from "@/components/cms/SettingsSubNav";
import { DataTable, type DataTableColumn } from "@/components/cms/settings/DataTable";
import { LockedFeature } from "@/components/cms/billing/FeatureGate";
import { siteHas } from "@/lib/billing/pricing";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/domains")({
  component: Domains,
});

interface DomainRow {
  id: string;
  host: string;
  kind: "primary" | "custom" | "preview";
  verified: boolean;
  ssl: "issued" | "pending" | "error";
}

const DOMAINS: DomainRow[] = [
  { id: "1", host: "acme.com", kind: "primary", verified: true, ssl: "issued" },
  { id: "2", host: "www.acme.com", kind: "custom", verified: true, ssl: "issued" },
  { id: "3", host: "shop.acme.com", kind: "custom", verified: false, ssl: "pending" },
  { id: "4", host: "acme.bettercms.site", kind: "preview", verified: true, ssl: "issued" },
  { id: "5", host: "staging.acme.bettercms.site", kind: "preview", verified: true, ssl: "issued" },
];

function Domains() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project);
  const plan = pr?.sitePlan ?? "free";

  const primary = DOMAINS.find((d) => d.kind === "primary");
  const custom = DOMAINS.filter((d) => d.kind === "custom");
  const preview = DOMAINS.filter((d) => d.kind === "preview");

  const [q, setQ] = useState("");
  const filteredCustom = useMemo(
    () => custom.filter((d) => !q || d.host.toLowerCase().includes(q.toLowerCase())),
    [custom, q],
  );

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

  return (
    <>
      <PageHeader
        title="Domains"
        description="Connect custom domains, verify ownership, and manage SSL."
        action={
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add domain
          </Button>
        }
      />

      {primary && (
        <SettingsSection title="Primary domain" description="The canonical URL for this site.">
          <div className="flex items-center justify-between py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-foreground">{primary.host}</span>
                <Badge variant="outline" className="text-[10px]">Primary</Badge>
                <StatusDot tone="success" />
                <span className="text-[11px] uppercase tracking-wider text-emerald-500">SSL issued</span>
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                All traffic redirects here. Change with care.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                <a href={`https://${primary.host}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" /> Open
                </a>
              </Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-[12px]">Change</Button>
            </div>
          </div>
        </SettingsSection>
      )}

      <SettingsSection title="Custom domains" description="Domains pointing to this project." flush>
        <DomainsDataTable
          rows={filteredCustom}
          toolbar={
            <>
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search domains…"
                  className="h-8 pl-8 text-[12px]"
                />
              </div>
              <span className="ml-auto text-[12px] text-muted-foreground">
                {filteredCustom.length} domain{filteredCustom.length === 1 ? "" : "s"}
              </span>
            </>
          }
        />
      </SettingsSection>

      <SettingsSection title="Preview domains" description="Auto-generated URLs for previews and staging." flush>
        <DomainsDataTable rows={preview} hideActions />
      </SettingsSection>

      <SettingsSection title="DNS instructions" description="Add these records at your registrar to verify a new domain.">
        <div className="space-y-3 py-4">
          <DnsRow type="A" name="@" value="76.76.21.21" />
          <DnsRow type="CNAME" name="www" value="cname.bettercms.site" />
          <DnsRow type="TXT" name="_bettercms" value="verify=abcd1234efgh5678" />
        </div>
      </SettingsSection>
    </>
  );
}

function DomainsDataTable({
  rows,
  hideActions = false,
  toolbar,
}: {
  rows: DomainRow[];
  hideActions?: boolean;
  toolbar?: React.ReactNode;
}) {
  const columns: DataTableColumn<DomainRow>[] = [
    {
      key: "host",
      header: "Domain",
      cell: (d) => <span className="font-mono">{d.host}</span>,
      sortAccessor: (d) => d.host,
    },
    {
      key: "verified",
      header: "Verification",
      cell: (d) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusDot tone={d.verified ? "success" : "warning"} />
          {d.verified ? "Verified" : "Pending"}
        </span>
      ),
      sortAccessor: (d) => (d.verified ? 1 : 0),
    },
    {
      key: "ssl",
      header: "SSL",
      cell: (d) => (
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={`capitalize ${d.ssl === "issued" ? "text-emerald-500" : d.ssl === "pending" ? "text-amber-500" : "text-rose-500"}`}>{d.ssl}</span>
        </span>
      ),
      sortAccessor: (d) => d.ssl,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: () =>
        !hideActions ? (
          <div className="inline-flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Open">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-500" title="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Open">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      rowKey={(d) => d.id}
      columns={columns}
      pageSize={10}
      maxHeight="480px"
      toolbar={toolbar}
      emptyTitle="No domains"
      emptyDescription="Add a custom domain to point traffic at this project."
    />
  );
}

function DnsRow({ type, name, value }: { type: string; name: string; value: string }) {
  return (
    <div className="grid grid-cols-[60px_120px_1fr_auto] items-center gap-3">
      <Badge variant="outline" className="justify-center font-mono text-[10px]">{type}</Badge>
      <Input readOnly value={name} className="font-mono" />
      <Input readOnly value={value} className="font-mono" />
      <Button variant="outline" size="icon" className="h-9 w-9" title="Copy">
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
