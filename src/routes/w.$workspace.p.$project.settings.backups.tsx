import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Camera, Download, GitCompareArrows, RotateCcw, Search } from "lucide-react";
import { PageHeader, SettingsSection, SettingsRow } from "@/components/cms/SettingsSubNav";
import { DataTable, type DataTableColumn } from "@/components/cms/settings/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCMS, select } from "@/lib/cms/store";
import type { Backup } from "@/lib/cms/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export const Route = createFileRoute("/w/$workspace/p/$project/settings/backups")({
  component: Backups,
});

function Backups() {
  const { workspace, project } = Route.useParams();
  const pr = select.projectBySlug(workspace, project)!;
  const backups = useCMS((s) => s.backups.filter((b) => b.projectId === pr.id));

  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => backups.filter((b) => !q || b.label.toLowerCase().includes(q.toLowerCase())),
    [backups, q],
  );

  const columns: DataTableColumn<Backup>[] = [
    {
      key: "label",
      header: "Label",
      cell: (b) => <span>{b.label}</span>,
      sortAccessor: (b) => b.label,
    },
    {
      key: "kind",
      header: "Type",
      cell: (b) => <Badge variant="outline" className="text-[10px] capitalize">{b.kind}</Badge>,
      sortAccessor: (b) => b.kind,
    },
    {
      key: "created",
      header: "Created",
      cell: (b) => (
        <span className="text-[12px] text-muted-foreground">
          {new Date(b.createdAt).toLocaleString()}
        </span>
      ),
      sortAccessor: (b) => b.createdAt,
    },
    {
      key: "createdBy",
      header: "Created by",
      cell: () => <span className="text-[12px] text-muted-foreground">System</span>,
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      cell: (b) => (
        <span className="font-mono text-[12px] text-muted-foreground">{formatBytes(b.sizeBytes)}</span>
      ),
      sortAccessor: (b) => b.sizeBytes,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: () => (
        <div className="inline-flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[12px]" title="Restore preview">
            <RotateCcw className="h-3 w-3" /> Preview
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[12px]" title="Compare">
            <GitCompareArrows className="h-3 w-3" /> Compare
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Download">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Backups"
        description="Point-in-time snapshots of your content and configuration."
        action={
          <Button size="sm" className="gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Take snapshot
          </Button>
        }
      />

      <div className="mb-8 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-600 dark:text-amber-400">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <span className="font-medium">Restoring is destructive.</span> A restore overwrites current
            content with the snapshot's state. Use "Restore preview" first to inspect changes.
          </div>
        </div>
      </div>

      <SettingsSection title="Schedule" description="Automatic snapshots run in the background.">
        <SettingsRow label="Daily automatic backups" description="Snapshot of all content, schemas, and settings.">
          <Switch defaultChecked />
        </SettingsRow>
        <SettingsRow label="Backup before publish" description="Take a snapshot whenever the site is deployed.">
          <Switch defaultChecked />
        </SettingsRow>
        <SettingsRow label="Retention policy" description="How long automatic snapshots are kept.">
          <Select defaultValue="30">
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="365">1 year</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Snapshots" description="All recoverable points in time." flush>
        <DataTable
          rows={filtered}
          rowKey={(b) => b.id}
          columns={columns}
          initialSort={{ key: "created", dir: "desc" }}
          emptyTitle="No snapshots match"
          emptyDescription="Take a snapshot or adjust your search."
          toolbar={
            <>
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by label…"
                  className="h-8 pl-8 text-[12px]"
                />
              </div>
              <span className="ml-auto text-[12px] text-muted-foreground">
                {filtered.length} snapshot{filtered.length === 1 ? "" : "s"}
              </span>
            </>
          }
        />
      </SettingsSection>
    </>
  );
}
