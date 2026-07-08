import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Plus, Trash2, Webhook, X } from "lucide-react";
import { toast } from "sonner";
import { SettingsHeader } from "@/components/cms/SettingsSubNav";
import { WEBHOOK_EVENTS, webhookActions, useWsDev } from "@/lib/workspace/tokens-store";
import { useCMS } from "@/lib/cms/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/w/$workspace/settings/webhooks")({
  component: Webhooks,
});

function Webhooks() {
  const { workspace: slug } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const dev = useWsDev(ws?.id ?? "");
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  if (!ws) return <SettingsHeader title="Webhooks" description="Workspace not found." />;

  return (
    <>
      <SettingsHeader title="Webhooks" description="Subscribe to events and deliver them to your endpoints." />

      <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
        <header className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
          <div>
            <div className="text-[14px] font-semibold text-foreground">Endpoints</div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Signed JSON payloads, retried on failure. The signing secret is shown once.</p>
          </div>
          <Button size="sm" className="h-8 text-[13px]" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New endpoint
          </Button>
        </header>

        {dev.webhooks.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[color:var(--color-elevated)] text-muted-foreground">
              <Webhook className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="mt-3 text-[13px] font-medium text-foreground">No endpoints configured</div>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
              Connect your first endpoint to receive real-time events for publishing, comments, and more.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border-hairline)]">
            {dev.webhooks.map((w) => (
              <li key={w.id} className="group flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[12.5px] text-foreground">{w.url}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {w.events.map((e) => (
                      <span key={e} className="rounded bg-[color:var(--s2)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{e}</span>
                    ))}
                  </div>
                </div>
                <Switch checked={w.active} onCheckedChange={(v) => webhookActions.setActive(ws.id, w.id, v)} aria-label={`${w.active ? "Pause" : "Resume"} ${w.url}`} />
                <button
                  type="button"
                  aria-label={`Delete ${w.url}`}
                  onClick={() => {
                    webhookActions.remove(ws.id, w.id);
                    toast.success("Endpoint removed");
                  }}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {adding && (
        <NewEndpointDialog
          onClose={() => setAdding(false)}
          onAdd={(url, events) => {
            const { secret: s } = webhookActions.add(ws.id, url, events);
            setAdding(false);
            setSecret(s);
          }}
        />
      )}
      {secret && <SecretDialog secret={secret} onClose={() => setSecret(null)} />}
    </>
  );
}

function NewEndpointDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (url: string, events: string[]) => void }) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["page.published"]);
  const valid = /^https:\/\/.+\..+/.test(url.trim()) && events.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="New endpoint" className="absolute left-1/2 top-[12vh] w-[min(480px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <Webhook className="h-4 w-4 text-primary" />
          <div className="flex-1 text-[14px] font-semibold text-foreground">New endpoint</div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3.5 p-4">
          <label className="block">
            <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Endpoint URL</div>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} autoFocus placeholder="https://api.yourapp.com/hooks/bettercms" className="font-mono text-[12.5px]" />
            <div className="mt-1 text-[11px] text-muted-foreground">HTTPS only. We retry failed deliveries with backoff.</div>
          </label>
          <div>
            <div className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">Events</div>
            <div className="grid grid-cols-2 gap-1.5">
              {WEBHOOK_EVENTS.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-[color:var(--border-hairline)] px-2.5 py-2 text-[12.5px] hover:bg-[color:var(--color-row-hover)]">
                  <Checkbox
                    checked={events.includes(e.id)}
                    onCheckedChange={() =>
                      setEvents((xs) => (xs.includes(e.id) ? xs.filter((x) => x !== e.id) : [...xs, e.id]))
                    }
                  />
                  <span className="text-foreground">{e.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={() => onAdd(url.trim(), events)}>Create endpoint</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SecretDialog({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Signing secret" className="absolute left-1/2 top-[16vh] w-[min(500px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-2xl">
        <div className="p-5 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
            <Check className="h-5 w-5" />
          </span>
          <h3 className="mt-3 text-[15px] font-semibold text-foreground">Endpoint created</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Use this signing secret to verify payloads. It will not be shown again.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-[color:var(--s2)] px-3 py-2.5 text-left font-mono text-[12px] text-foreground">{secret}</code>
            <Button size="sm" variant={copied ? "outline" : "default"} className="h-9 shrink-0" onClick={() => { navigator.clipboard.writeText(secret); setCopied(true); toast.success("Secret copied"); }}>
              {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="mt-4" onClick={onClose} disabled={!copied}>
            {copied ? "Done" : "Copy the secret to continue"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
