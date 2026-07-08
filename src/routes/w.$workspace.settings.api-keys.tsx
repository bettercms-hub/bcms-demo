import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, KeyRound, Plus, Server, Trash2, User2, X } from "lucide-react";
import { toast } from "sonner";
import { SettingsHeader } from "@/components/cms/SettingsSubNav";
import { tokenActions, useWsDev, type ApiToken, type TokenKind } from "@/lib/workspace/tokens-store";
import { useCMS } from "@/lib/cms/store";
import { formatRelative } from "@/lib/cms/format-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/w/$workspace/settings/api-keys")({
  component: ApiKeys,
});

function ApiKeys() {
  const { workspace: slug } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const dev = useWsDev(ws?.id ?? "");
  const [creating, setCreating] = useState<TokenKind | null>(null);
  const [reveal, setReveal] = useState<{ name: string; raw: string } | null>(null);

  if (!ws) return <SettingsHeader title="API Keys" description="Workspace not found." />;

  const personal = dev.tokens.filter((t) => t.kind === "personal");
  const machine = dev.tokens.filter((t) => t.kind === "machine");

  return (
    <>
      <SettingsHeader title="API Keys" description="Personal and machine tokens for programmatic access. Values are shown once, at creation." />

      <TokenCard
        icon={User2}
        title="Personal tokens"
        description="Scoped to your user. Revoked when you leave the workspace."
        tokens={personal}
        onNew={() => setCreating("personal")}
        onRevoke={(t) => {
          tokenActions.revoke(ws.id, t.id);
          toast.success(`${t.name} revoked`);
        }}
      />
      <div className="h-4" />
      <TokenCard
        icon={Server}
        title="Machine tokens"
        description="Long-lived tokens for servers, CI, and integrations."
        tokens={machine}
        onNew={() => setCreating("machine")}
        onRevoke={(t) => {
          tokenActions.revoke(ws.id, t.id);
          toast.success(`${t.name} revoked`);
        }}
      />

      {creating && (
        <NewTokenDialog
          kind={creating}
          onClose={() => setCreating(null)}
          onCreate={(name) => {
            const { raw } = tokenActions.create(ws.id, creating, name);
            setCreating(null);
            setReveal({ name, raw });
          }}
        />
      )}
      {reveal && <RevealDialog name={reveal.name} raw={reveal.raw} onClose={() => setReveal(null)} />}
    </>
  );
}

function TokenCard({
  icon: Icon,
  title,
  description,
  tokens,
  onNew,
  onRevoke,
}: {
  icon: typeof KeyRound;
  title: string;
  description: string;
  tokens: ApiToken[];
  onNew: () => void;
  onRevoke: (t: ApiToken) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
      <header className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--color-elevated)] text-primary">
            <Icon className="h-[16px] w-[16px]" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-foreground">{title}</div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button size="sm" className="h-8 text-[13px]" onClick={onNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New token
        </Button>
      </header>

      {tokens.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[color:var(--color-elevated)] text-muted-foreground">
            <KeyRound className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="mt-3 text-[13px] font-medium text-foreground">No tokens yet</div>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            Create your first token to start authenticating API requests.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--border-hairline)]">
          {tokens.map((t) => (
            <li key={t.id} className="group flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-foreground">{t.name}</div>
                <div className="font-mono text-[11.5px] text-muted-foreground">{t.masked}</div>
              </div>
              <span className="text-[11.5px] text-muted-foreground">created {formatRelative(new Date(t.createdAt).toISOString())}</span>
              <button
                type="button"
                aria-label={`Revoke ${t.name}`}
                onClick={() => onRevoke(t)}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewTokenDialog({ kind, onClose, onCreate }: { kind: TokenKind; onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  const valid = name.trim().length >= 2;
  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="New token" className="absolute left-1/2 top-[16vh] w-[min(440px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <KeyRound className="h-4 w-4 text-primary" />
          <div className="flex-1 text-[14px] font-semibold text-foreground">New {kind === "personal" ? "personal" : "machine"} token</div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <label className="block">
            <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Name</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && valid && onCreate(name)}
              autoFocus
              placeholder={kind === "personal" ? "Local development" : "CI deploys"}
            />
            <div className="mt-1 text-[11px] text-muted-foreground">Something that tells you where this token lives.</div>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={() => onCreate(name)}>Create token</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RevealDialog({ name, raw, onClose }: { name: string; raw: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(raw);
    setCopied(true);
    toast.success("Token copied");
  }
  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Token created" className="absolute left-1/2 top-[16vh] w-[min(500px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-2xl">
        <div className="p-5 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
            <Check className="h-5 w-5" />
          </span>
          <h3 className="mt-3 text-[15px] font-semibold text-foreground">{name} created</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Copy it now. For your security, it will not be shown again.</p>
          <div className="mt-4 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-[color:var(--s2)] px-3 py-2.5 text-left font-mono text-[12px] text-foreground">{raw}</code>
            <Button size="sm" variant={copied ? "outline" : "default"} className="h-9 shrink-0" onClick={copy}>
              {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="mt-4" onClick={onClose} disabled={!copied}>
            {copied ? "Done" : "Copy the token to continue"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
