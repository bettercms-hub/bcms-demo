import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { SettingsHeader, SettingsSection, SettingsRow } from "@/components/cms/SettingsSubNav";
import { MetricTile, MetricGrid } from "@/components/cms/ui/MetricTile";
import { UsageBar } from "@/components/cms/ui/UsageBar";
import { StatusBadge } from "@/components/cms/ui/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { SITE_PLANS, fmtCompact, fmtGB } from "@/lib/billing/pricing";
import type { ProjectFramework } from "@/lib/cms/types";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/api")({
  component: ApiSettings,
});

/* ── stable key seeding (demo API keys only) ── */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/* Deterministic per-project key so it stays stable across renders/reloads. */
function stableKey(prefix: string, seed: string) {
  let h = hash(seed);
  let s = "";
  for (let i = 0; i < 18; i++) {
    h = Math.imul(h ^ (h >>> 13), 16777619);
    s += (Math.abs(h) % 36).toString(36);
  }
  return `${prefix}_${s}`;
}

type ProjectKey = { name: string; tone: "success" | "warning" | "danger"; value: string; caps: string };

const SCOPES = ["Read-only", "Read & draft", "Read & write", "Full access"] as const;
type Scope = (typeof SCOPES)[number];

type Token = { id: string; name: string; scope: Scope; token: string; lastUsed?: string };

function mkToken(scope: Scope) {
  const p = scope === "Read-only" ? "ro" : scope === "Read & draft" ? "dr" : scope === "Read & write" ? "rw" : "full";
  const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8);
  return `bcms_${p}_${rand}`;
}

function ApiSettings() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project);
  const projectId = pr?.id ?? "pr_unknown";

  const planDef = SITE_PLANS[pr?.sitePlan ?? "free"];
  const limits = planDef.limits;
  const usage = pr?.usage;

  const keys: ProjectKey[] = [
    {
      name: "Public",
      tone: "success",
      value: stableKey("bcms_pub", projectId + "pub"),
      caps: "Read published content, SEO, schema, sitemap, and public form config. Safe to embed in frontend browser code.",
    },
    {
      name: "Preview",
      tone: "warning",
      value: stableKey("bcms_prev", projectId + "prev"),
      caps: "Read draft content and draft SEO for previews. Keep server-side only — never expose in the browser.",
    },
    {
      name: "Server",
      tone: "danger",
      value: stableKey("bcms_srv", projectId + "srv"),
      caps: "Submit forms, read analytics, and run protected server-side actions. Never expose in the browser.",
    },
  ];

  const restUrl = `https://api.bettercms.site/v1/${projectId}`;
  const gqlUrl = `https://graphql.bettercms.site/v1/${projectId}`;
  const staging = `${pr?.slug ?? project}.bettercms.site`;
  const [env, setEnv] = useState("published");
  const [prodUrl, setProdUrl] = useState("https://acme.com");

  const [tokens, setTokens] = useState<Token[]>(() => [
    { id: "tk_prod", name: "Production", scope: "Read-only", token: mkToken("Read-only"), lastUsed: "2h ago" },
    { id: "tk_preview", name: "Preview", scope: "Read & draft", token: mkToken("Read & draft"), lastUsed: "1d ago" },
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [origins, setOrigins] = useState<string[]>(["https://acme.com", "http://localhost:3000"]);
  const [originInput, setOriginInput] = useState("");

  function addToken(name: string, scope: Scope) {
    setTokens((t) => [{ id: `tk_${Date.now().toString(36)}`, name, scope, token: mkToken(scope) }, ...t]);
    toast.success(`Token “${name}” created`);
  }
  function revoke(id: string) {
    setTokens((t) => t.filter((x) => x.id !== id));
    toast.success("Token revoked");
  }
  function addOrigin() {
    const v = originInput.trim();
    if (!v) return;
    if (origins.includes(v)) {
      toast.error("Origin already added");
      return;
    }
    setOrigins((o) => [...o, v]);
    setOriginInput("");
  }

  const snippet = quickstart(pr?.framework, restUrl);

  return (
    <>
      <SettingsHeader
        title="API"
        description="Everything you need to query this project's content from your own code."
      />

      {pr?.kind !== "headless" ? (
        <div className="mb-6 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-4 py-3 text-[12.5px] text-muted-foreground">
          This is a <span className="font-medium text-foreground">managed</span> site — hosting and publishing are handled
          for you. The content API below is available too if you want to read data elsewhere.
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-primary/25 bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)] px-4 py-3 text-[12.5px] leading-relaxed text-foreground/85">
          This is a <span className="font-medium">Headless Project</span>. BetterCMS manages your content, SEO, forms,
          analytics, schema, redirects, sitemap, APIs, and visual editing. Your production frontend connects to BetterCMS
          using APIs or SDK.
        </div>
      )}

      {/* Project & domains */}
      <SettingsSection title="Project & domains" description="Identifiers and the addresses tied to this project.">
        <div className="space-y-3">
          <CopyRow label="Project slug" value={pr?.slug ?? project} mono />
          <SettingsRow label="Staging preview domain" description="Managed by BetterCMS · shows drafts in the visual editor.">
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="flex-1 truncate font-mono text-[12.5px] text-foreground">{staging}</span>
              <button
                type="button"
                onClick={() => copy(`https://${staging}`)}
                aria-label="Copy"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </SettingsRow>
          <SettingsRow label="Production frontend URL" description="Where your live site is hosted (Vercel, Netlify, your own server…).">
            <Input value={prodUrl} onChange={(e) => setProdUrl(e.target.value)} placeholder="https://your-site.com" className="font-mono" />
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* Project keys — the three scoped keys */}
      <SettingsSection
        title="Project keys"
        description="Three scoped keys per project. Only the public key may appear in browser code — preview and server keys are secrets."
      >
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.name}
              className="rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--card)] p-3.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-[13px] font-medium text-foreground">{k.name} key</span>
                <StatusBadge label={k.tone === "success" ? "Browser-safe" : "Secret"} tone={k.tone} />
                <div className="ml-auto">
                  <TokenValue value={k.value} />
                </div>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{k.caps}</p>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Endpoints */}
      <SettingsSection title="Endpoints" description="Base URLs for this project's Content Delivery API.">
        <div className="space-y-3">
          <CopyRow label="Project ID" value={projectId} mono />
          <CopyRow label="Content Delivery API (REST)" value={`${restUrl}/content`} mono />
          <CopyRow label="GraphQL endpoint" value={gqlUrl} mono />
          <SettingsRow label="Environment" description="Query published content, or drafts (needs a draft-scoped token).">
            <Select value={env} onValueChange={setEnv}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft / Preview</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* Tokens */}
      <SettingsSection
        title="Access tokens"
        description="Bearer tokens for the API. Store them as secrets — never commit them."
        action={
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> New token
          </button>
        }
      >
        <div className="overflow-hidden rounded-lg border border-[color:var(--border-hairline)]">
          {tokens.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              No tokens yet. Create one to start querying.
            </div>
          ) : (
            tokens.map((t, i) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 px-3.5 py-3 ${i > 0 ? "border-t border-[color:var(--border-hairline)]" : ""}`}
              >
                <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-foreground">{t.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    Last used {t.lastUsed ?? "never"}
                  </div>
                </div>
                <div className="ml-1"><StatusBadge label={t.scope} tone={t.scope === "Full access" ? "warning" : "muted"} /></div>
                <div className="ml-auto flex items-center gap-1">
                  <TokenValue value={t.token} />
                  <button
                    type="button"
                    onClick={() => revoke(t.id)}
                    aria-label="Revoke token"
                    title="Revoke"
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-rose-500/12 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </SettingsSection>

      {/* Usage */}
      <SettingsSection
        title="Usage this period"
        description={`On the ${planDef.name} plan · resets on the 1st.`}
      >
        <div className="space-y-4 py-2">
          <MetricGrid cols={4}>
            <MetricTile
              label="API requests"
              value={fmtCompact(usage?.apiRequests ?? 0)}
              sublabel={limits.apiRequests != null ? `of ${fmtCompact(limits.apiRequests)}` : "Custom limits"}
              accent
            />
            <MetricTile
              label="Bandwidth"
              value={fmtGB(usage?.bandwidthGB ?? 0)}
              sublabel={limits.bandwidthGB != null ? `of ${fmtGB(limits.bandwidthGB)}` : "Custom limits"}
            />
            <MetricTile
              label="AI credits"
              value={fmtCompact(usage?.aiCreditsUsed ?? 0)}
              sublabel={limits.aiCredits != null ? `of ${fmtCompact(limits.aiCredits)}` : "Custom limits"}
            />
            <MetricTile
              label="Asset storage"
              value={fmtGB(usage?.storageGB ?? 0)}
              sublabel={limits.storageGB != null ? `of ${fmtGB(limits.storageGB)}` : "Custom limits"}
            />
          </MetricGrid>
          <div className="space-y-4">
            {limits.apiRequests != null && (
              <UsageBar value={usage?.apiRequests ?? 0} limit={limits.apiRequests} label="API requests" format={fmtCompact} />
            )}
            {limits.bandwidthGB != null && (
              <UsageBar value={usage?.bandwidthGB ?? 0} limit={limits.bandwidthGB} label="Bandwidth" unit="GB" />
            )}
          </div>
        </div>
      </SettingsSection>

      {/* CORS */}
      <SettingsSection
        title="Allowed origins (CORS)"
        description="Browser requests from these origins can call the API. Server-side calls aren't restricted."
      >
        <div className="space-y-2">
          {origins.map((o) => (
            <div
              key={o}
              className="flex items-center gap-2 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--card)] px-3 py-2"
            >
              <span className="flex-1 truncate font-mono text-[12.5px] text-foreground">{o}</span>
              <button
                type="button"
                onClick={() => setOrigins((cur) => cur.filter((x) => x !== o))}
                aria-label={`Remove ${o}`}
                className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOrigin())}
              placeholder="https://example.com"
              className="font-mono"
            />
            <button
              type="button"
              onClick={addOrigin}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* Quickstart */}
      <SettingsSection title="Quickstart" description="Fetch your content with a read-only token.">
        <div className="overflow-hidden rounded-lg border border-[color:var(--color-border)]">
          <div className="flex items-center justify-between border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {frameworkLabel(pr?.framework)}
            </span>
            <button
              type="button"
              onClick={() => copy(snippet, "Snippet copied")}
              className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <pre className="overflow-x-auto bg-[color:var(--s1)] p-3.5 text-[12px] leading-relaxed text-foreground">
            <code>{snippet}</code>
          </pre>
        </div>
      </SettingsSection>

      <NewTokenDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={addToken} />
    </>
  );
}

/* ── bits ── */

function copy(text: string, label = "Copied to clipboard") {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(label),
    () => toast.error("Couldn't copy"),
  );
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <SettingsRow label={label}>
      <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-3 py-1.5">
        <span className={`flex-1 truncate text-[12.5px] text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
        <button
          type="button"
          onClick={() => copy(value)}
          aria-label="Copy"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </SettingsRow>
  );
}

function TokenValue({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-1 rounded-md border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-2 py-1">
      <span className="font-mono text-[11.5px] text-foreground">
        {show ? value : `${value.slice(0, 9)}${"•".repeat(10)}`}
      </span>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="text-[10.5px] font-medium text-primary hover:underline"
      >
        {show ? "Hide" : "Show"}
      </button>
      <button
        type="button"
        onClick={() => copy(value, "Token copied")}
        aria-label="Copy token"
        className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function NewTokenDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (name: string, scope: Scope) => void;
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>("Read-only");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setName("");
          setScope("Read-only");
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New API token</DialogTitle>
          <DialogDescription>You'll only see the full token once — copy it somewhere safe.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onCreate(name.trim(), scope);
            onOpenChange(false);
          }}
          className="space-y-4"
        >
          <label className="block">
            <div className="mb-1.5 text-[12px] font-medium text-foreground">Name</div>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production read" maxLength={40} />
          </label>
          <label className="block">
            <div className="mb-1.5 text-[12px] font-medium text-foreground">Scope</div>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Create token
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function frameworkLabel(f?: ProjectFramework) {
  return f === "astro" ? "Astro" : f === "nuxt" ? "Nuxt" : f === "sveltekit" ? "SvelteKit" : "Next.js / JavaScript";
}

function quickstart(f: ProjectFramework | undefined, restUrl: string) {
  if (f === "astro") {
    return `---\nconst res = await fetch("${restUrl}/content/posts", {\n  headers: { Authorization: \`Bearer \${import.meta.env.BCMS_TOKEN}\` },\n});\nconst posts = await res.json();\n---`;
  }
  return `const res = await fetch("${restUrl}/content/posts", {\n  headers: { Authorization: \`Bearer \${process.env.BCMS_TOKEN}\` },\n  next: { revalidate: 60 },\n});\nconst posts = await res.json();`;
}
