import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, Download, Eye, EyeOff, History, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { PageHeader, SettingsSection } from "@/components/cms/SettingsSubNav";
import { DataTable, type DataTableColumn } from "@/components/cms/settings/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCMS, select } from "@/lib/cms/store";
import type { EnvironmentVariable } from "@/lib/cms/types";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/env")({
  component: EnvVars,
});

function EnvVars() {
  const { workspace, project } = Route.useParams();
  const pr = select.projectBySlug(workspace, project)!;
  const vars = useCMS((s) => s.envVars.filter((v) => v.projectId === pr.id));

  const [scope, setScope] = useState("all");
  const [q, setQ] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    return vars.filter((v) => {
      if (scope !== "all" && v.scope !== scope) return false;
      if (q && !v.key.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [vars, scope, q]);

  const columns: DataTableColumn<EnvironmentVariable>[] = [
    {
      key: "key",
      header: "Key",
      cell: (v) => <div className="font-mono text-[12px] font-medium">{v.key}</div>,
      sortAccessor: (v) => v.key,
    },
    {
      key: "value",
      header: "Value",
      cell: (v) => (
        <span className="font-mono text-[12px] text-muted-foreground">
          {revealed[v.id] ? (v.value ?? "—") : "•".repeat(12)}
        </span>
      ),
    },
    {
      key: "scope",
      header: "Scope",
      cell: (v) => <Badge variant="outline" className="text-[10px] capitalize">{v.scope}</Badge>,
      sortAccessor: (v) => v.scope,
    },
    {
      key: "updated",
      header: "Last edited",
      cell: (v) => (
        <span className="text-[12px] text-muted-foreground">
          {new Date(v.updatedAt).toLocaleDateString()}
          <span className="ml-2 text-[11px]">by you</span>
        </span>
      ),
      sortAccessor: (v) => v.updatedAt,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (v) => {
        const isOpen = revealed[v.id];
        return (
          <div className="inline-flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={isOpen ? "Hide" : "Reveal"}
              onClick={() => setRevealed((r) => ({ ...r, [v.id]: !r[v.id] }))}
            >
              {isOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Copy">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Environment variables"
        description="Secrets and configuration available to server code and integrations. Encrypted at rest."
        action={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Import
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <History className="h-3.5 w-3.5" /> History
            </Button>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add variable
            </Button>
          </div>
        }
      />

      <SettingsSection title="Variables" description="Scoped per environment. Values are never exposed to the client." flush>
        <DataTable
          rows={filtered}
          rowKey={(v) => v.id}
          columns={columns}
          selectable
          initialSort={{ key: "key", dir: "asc" }}
          emptyTitle="No variables in this scope"
          emptyDescription="Add a variable to expose configuration to your server code."
          bulkActions={(ids, clear) => (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-[12px] text-destructive" onClick={clear}>
              <Trash2 className="h-3 w-3" /> Delete ({ids.length})
            </Button>
          )}
          toolbar={
            <>
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search keys…"
                  className="h-8 pl-8 text-[12px]"
                />
              </div>
              <Tabs value={scope} onValueChange={setScope}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-[12px]">All</TabsTrigger>
                  <TabsTrigger value="production" className="text-[12px]">Production</TabsTrigger>
                  <TabsTrigger value="preview" className="text-[12px]">Preview</TabsTrigger>
                  <TabsTrigger value="development" className="text-[12px]">Development</TabsTrigger>
                </TabsList>
              </Tabs>
              <span className="ml-auto text-[12px] text-muted-foreground">
                {filtered.length} variable{filtered.length === 1 ? "" : "s"}
              </span>
            </>
          }
        />
      </SettingsSection>
    </>
  );
}
