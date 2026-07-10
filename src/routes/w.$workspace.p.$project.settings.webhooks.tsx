import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Plus, RotateCw, Webhook, X } from "lucide-react";
import { SettingsHeader, SettingsSection, SettingsRow } from "@/components/cms/SettingsSubNav";
import { StatusBadge } from "@/components/cms/ui/StatusBadge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getProjectBySlug } from "@/lib/cms/use-cms";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/webhooks")({
  component: ProjectWebhooks,
});

function rand(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 36).toString(36);
  return s;
}

type Dest = { id: string; url: string; events: string; status: "active" | "failing" };

function ProjectWebhooks() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project);

  const [secret, setSecret] = useState(`whsec_${rand(24)}`);
  const [showSecret, setShowSecret] = useState(false);
  const [dests, setDests] = useState<Dest[]>([
    { id: "wh1", url: "https://api.vercel.com/v1/integrations/deploy/prj_acme", events: "content.published", status: "active" },
    { id: "wh2", url: "https://hooks.slack.com/services/T00/B00/xyz", events: "content.published, content.updated", status: "active" },
  ]);
  const [url, setUrl] = useState("");

  function addDest() {
    const v = url.trim();
    if (!v) return;
    setDests((d) => [{ id: `wh_${Date.now().toString(36)}`, url: v, events: "content.published", status: "active" }, ...d]);
    setUrl("");
    toast.success("Destination added");
  }

  return (
    <>
      <SettingsHeader
        title="Webhooks"
        description="Notify external services when content changes: trigger a frontend rebuild, sync a search index, or ping a channel."
      />

      <div className="mb-6 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
        For a <span className="font-medium text-foreground">headless project</span>, webhooks fire when content is
        published or updated in the production API. That's how your externally-hosted frontend knows to rebuild.
      </div>

      <SettingsSection
        title="Signing secret"
        description="We sign each request with this secret so you can verify it came from BetterCMS."
      >
        <SettingsRow label="Secret">
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-3 py-1.5">
            <span className="flex-1 truncate font-mono text-[12.5px] text-foreground">
              {showSecret ? secret : `whsec_${"•".repeat(20)}`}
            </span>
            <button type="button" onClick={() => setShowSecret((v) => !v)} className="text-[11px] font-medium text-primary hover:underline">
              {showSecret ? "Hide" : "Reveal"}
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(secret).then(() => toast.success("Secret copied"))}
              aria-label="Copy secret"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setSecret(`whsec_${rand(24)}`);
                toast.success("Signing secret rotated");
              }}
              aria-label="Rotate secret"
              title="Rotate"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Destinations" description="Endpoints that receive webhook deliveries.">
        <div className="space-y-2">
          {dests.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--card)] px-3.5 py-2.5">
              <Webhook className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[12.5px] text-foreground">{d.url}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{d.events}</div>
              </div>
              <StatusBadge label={d.status} tone={d.status === "active" ? "success" : "danger"} />
              <button
                type="button"
                onClick={() => setDests((cur) => cur.filter((x) => x.id !== d.id))}
                aria-label="Remove destination"
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-rose-500/12 hover:text-rose-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDest())}
              placeholder="https://your-service.com/webhook"
              className="font-mono"
            />
            <button
              type="button"
              onClick={addDest}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>
      </SettingsSection>

      {pr?.kind && pr.kind !== "headless" && (
        <p className="text-[12px] text-muted-foreground">
          This is a managed site. Deploys are handled by BetterCMS, so external rebuild hooks are optional.
        </p>
      )}
    </>
  );
}
