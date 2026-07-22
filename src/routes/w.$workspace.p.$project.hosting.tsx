import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  Github,
  Globe,
  Lock,
  Rocket,
  RotateCcw,
  ScrollText,
  Server,
  Sparkles,
} from "lucide-react";
import { PageShell, Section } from "@/components/cms/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { projectActions, useCMS } from "@/lib/cms/store";
import {
  DEPLOY_STATUS_META,
  buildLogLines,
  injectedEnv,
  previewUrl,
  seedDeployments,
  type Deployment,
} from "@/lib/hosting/demo";
import type { FrontendHosting, Project } from "@/lib/cms/types";
import { toast } from "sonner";

export const Route = createFileRoute("/w/$workspace/p/$project/hosting")({
  component: HostingPage,
});

/** Simulated pipeline: stage, seconds in stage, log lines revealed by its end. */
const SIM_STAGES = [
  { status: "queued" as const, ms: 900, logTo: 1 },
  { status: "installing" as const, ms: 1600, logTo: 5 },
  { status: "building" as const, ms: 2400, logTo: 13 },
  { status: "deploying" as const, ms: 1600, logTo: 16 },
  { status: "live" as const, ms: 0, logTo: 17 },
];

function HostingPage() {
  const { workspace, project } = Route.useParams();
  const pr = useCMS((s) =>
    s.projects.find((p) => p.slug === project && s.workspaces.some((w) => w.slug === workspace && w.id === p.workspaceId)),
  );

  const [deployments, setDeployments] = useState<Deployment[] | null>(null);
  const [logFor, setLogFor] = useState<Deployment | null>(null);
  const [simLogCount, setSimLogCount] = useState(0);
  const [switchTo, setSwitchTo] = useState<"external" | "bettercms" | null>(null);
  const [stagingPrivate, setStagingPrivate] = useState(false);
  const simTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const simActiveId = useRef<string | null>(null);

  useEffect(() => () => simTimers.current.forEach(clearTimeout), []);

  if (!pr) return null;
  const hosting: FrontendHosting = pr.hosting ?? { mode: "external" };
  const mode = hosting.mode;
  const staging = `${pr.slug}.bettercms.site`;
  const deps = deployments ?? seedDeployments(pr);
  const logLines = buildLogLines(pr);

  function patchDeployment(id: string, patch: Partial<Deployment>) {
    setDeployments((cur) => (cur ?? seedDeployments(pr!)).map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function startDeploy(message: string, env: Deployment["env"] = "production", branch?: string) {
    simTimers.current.forEach(clearTimeout);
    simTimers.current = [];
    const id = `sim-${deps.length + 1}-${message.length}`;
    simActiveId.current = id;
    const dep: Deployment = {
      id,
      env,
      branch: branch ?? hosting.branch ?? "main",
      commit: "4e19abc",
      message,
      author: "You",
      status: "queued",
      when: new Date().toISOString(),
      url: env === "production" ? staging : previewUrl(branch ?? "preview", pr!.slug),
    };
    setSimLogCount(0);
    setDeployments((cur) => {
      const list = cur ?? seedDeployments(pr!);
      // A new production deploy supersedes the old live one when it lands.
      return [dep, ...list];
    });

    let elapsed = 0;
    for (const stage of SIM_STAGES) {
      const t = setTimeout(() => {
        if (simActiveId.current !== id) return;
        patchDeployment(id, {
          status: stage.status,
          ...(stage.status === "live" ? { durationSec: 6 } : {}),
        });
        setSimLogCount(stage.logTo);
        if (stage.status === "live") {
          if (env === "production") {
            setDeployments((cur) =>
              (cur ?? []).map((d) =>
                d.id !== id && d.env === "production" && d.status === "live" ? { ...d, status: "superseded" } : d,
              ),
            );
          }
          toast.success(`Deployed to ${dep.url}`);
        }
      }, elapsed);
      simTimers.current.push(t);
      elapsed += stage.ms;
    }
  }

  function rollback(dep: Deployment) {
    setDeployments((cur) =>
      (cur ?? seedDeployments(pr!)).map((d) => {
        if (d.id === dep.id) return { ...d, status: "live" as const };
        if (d.env === "production" && d.status === "live") return { ...d, status: "superseded" as const };
        return d;
      }),
    );
    toast.success(`Rolled back. Production now serves ${dep.commit}.`);
  }

  const liveProd = deps.find((d) => d.env === "production" && d.status === "live");
  const activeSim = deps.find((d) => d.id === simActiveId.current && d.status !== "live" && d.status !== "failed");
  // Live view of whichever deployment the log dialog points at.
  const logDep = logFor ? (deps.find((d) => d.id === logFor.id) ?? logFor) : null;

  return (
    <PageShell
      breadcrumbs={[
        { label: workspace, to: "/w/$workspace", params: { workspace } },
        { label: pr.name, to: "/w/$workspace/p/$project/editor", params: { workspace, project } },
        { label: "Hosting" },
      ]}
      title="Hosting"
      description="Your CMS is the same either way. Choose who runs the frontend."
      width="default"
      actions={
        mode === "bettercms" ? (
          <Button
            size="sm"
            className="gap-1.5"
            disabled={Boolean(activeSim)}
            onClick={() => startDeploy("Manual deploy from the dashboard")}
          >
            <Rocket className="h-3.5 w-3.5" strokeWidth={1.75} />
            {activeSim ? "Deploying…" : "Deploy"}
          </Button>
        ) : undefined
      }
    >
      {/* Mode */}
      <Section title="Hosting mode" description="Switch any time. Content, APIs and settings stay exactly as they are.">
        <div className="grid gap-3 md:grid-cols-2">
          <ModeCard
            active={mode === "bettercms"}
            recommended
            icon={Server}
            title="BetterCMS Hosting"
            tagline="Connect GitHub and we build, deploy and host the frontend. Staging and production included."
            points={[
              "Push to deploy, with branch previews",
              `Staging on ${staging}`,
              "APIs, preview keys and env vars wired in automatically",
            ]}
            onClick={() => mode !== "bettercms" && setSwitchTo("bettercms")}
          />
          <ModeCard
            active={mode === "external"}
            icon={Globe}
            title="External hosting"
            tagline="Deploy to Vercel, Netlify, Cloudflare or your own server. We stay the content backend."
            points={[
              "You own the deploy pipeline",
              "We ping your rebuild webhook on publish",
              "Connect your production and staging URLs",
            ]}
            onClick={() => mode !== "external" && setSwitchTo("external")}
          />
        </div>
      </Section>

      {mode === "external" ? (
        <ExternalHosting pr={pr} workspace={workspace} project={project} onSwitch={() => setSwitchTo("bettercms")} />
      ) : (
        <>
          {/* Repository + build settings */}
          <Section
            title="Repository"
            description="Auto detected from the repo. Override anything, we rebuild on the next deploy."
          >
            <RepoCard hosting={hosting} onSave={(h) => { projectActions.setHosting(pr.id, h); toast.success("Build settings saved"); }} />
          </Section>

          {/* Environments */}
          <Section title="Environments" description="Every branch gets a preview. Production follows your default branch.">
            <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
              <EnvRow
                label="Production"
                url={pr.domain ?? staging}
                detail={
                  liveProd
                    ? `Serving ${liveProd.commit} · ${liveProd.message}`
                    : "No live deployment yet"
                }
                live={Boolean(liveProd)}
                chip={pr.domain ? "Custom domain" : "bettercms.site"}
              />
              <EnvRow
                label="Staging"
                url={staging}
                detail={
                  stagingPrivate
                    ? "Restricted to workspace members. The visual editor and draft previews point here."
                    : "Always on. The visual editor and draft previews point here."
                }
                live
                chip="Included"
                locked={stagingPrivate}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border-hairline)] px-5 py-3.5">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-foreground">Private staging</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                    {stagingPrivate
                      ? "Only signed-in members and guests of this workspace can open the staging URL."
                      : "Anyone with the staging link can view it. Turn on to require workspace membership."}
                  </div>
                </div>
                <Switch
                  checked={stagingPrivate}
                  onCheckedChange={(on) => {
                    setStagingPrivate(on);
                    toast.success(on ? "Staging is now private" : "Staging is public again");
                  }}
                  aria-label="Toggle private staging"
                />
              </div>
              <div className="border-t border-[color:var(--border-hairline)] px-5 py-3 text-[12px] text-muted-foreground">
                Branch previews deploy to{" "}
                <code className="rounded bg-[color:var(--s2)] px-1 py-0.5 font-mono text-[11px]">
                  {"{branch}"}-{pr.slug}.bettercms.site
                </code>{" "}
                automatically when auto deploy is on.
              </div>
            </div>
          </Section>

          {/* Injected env */}
          <Section
            title="Injected environment"
            description="Added at build time for every deploy. Secrets are encrypted at rest and never reach the browser bundle."
          >
            <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
              {injectedEnv(pr).map((v, i) => (
                <div
                  key={v.name}
                  className={`flex items-center gap-3 px-5 py-2.5 ${i > 0 ? "border-t border-[color:var(--border-hairline)]" : ""}`}
                >
                  <code className="w-64 shrink-0 truncate font-mono text-[12px] text-foreground">{v.name}</code>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-muted-foreground">{v.value}</span>
                  {v.secret && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-status-warning/10 px-1.5 py-0.5 text-[10.5px] font-medium text-status-warning">
                      <Lock className="h-3 w-3" /> Server only
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Deployments */}
          <Section
            title="Deployments"
            description="Build history with logs and one-click rollback."
            meta={`${deps.length}`}
          >
            <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
              {deps.map((d, i) => {
                const meta = DEPLOY_STATUS_META[d.status];
                const inFlight = ["queued", "installing", "building", "deploying"].includes(d.status);
                return (
                  <div
                    key={d.id}
                    className={`flex flex-wrap items-center gap-3 px-5 py-3 ${i > 0 ? "border-t border-[color:var(--border-hairline)]" : ""}`}
                  >
                    <span
                      className={`inline-flex w-[104px] shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${meta.tone}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${inFlight ? "animate-pulse" : ""}`} />
                      {meta.label}
                    </span>
                    <span
                      className={`w-20 shrink-0 text-[11px] font-medium uppercase tracking-wide ${
                        d.env === "production" ? "text-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {d.env}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-foreground">{d.message}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        <GitBranch className="h-3 w-3" />
                        <span className="font-mono">{d.branch}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="font-mono">{d.commit}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span>{d.author}</span>
                        {d.durationSec != null && (
                          <>
                            <span className="text-muted-foreground/50">·</span>
                            <span>{d.durationSec}s</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setLogFor(d)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                      >
                        <ScrollText className="h-3.5 w-3.5" /> Logs
                      </button>
                      {d.status === "superseded" && d.env === "production" && (
                        <button
                          type="button"
                          onClick={() => rollback(d)}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Rollback
                        </button>
                      )}
                      {(d.status === "live" || d.status === "failed") && (
                        <button
                          type="button"
                          onClick={() => startDeploy(`Redeploy of ${d.commit}`, d.env, d.branch)}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                        >
                          <Rocket className="h-3.5 w-3.5" /> Redeploy
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </>
      )}

      {/* Log viewer */}
      <Dialog open={logDep != null} onOpenChange={(o) => !o && setLogFor(null)}>
        <DialogContent className="sm:max-w-[640px]">
          {logDep && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Build log
                  <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ${DEPLOY_STATUS_META[logDep.status].tone}`}>
                    {DEPLOY_STATUS_META[logDep.status].label}
                  </span>
                </DialogTitle>
                <DialogDescription className="font-mono text-[12px]">
                  {logDep.branch} · {logDep.commit} · {logDep.url}
                </DialogDescription>
              </DialogHeader>
              <pre className="max-h-[360px] overflow-y-auto rounded-lg bg-[#0d1117] p-4 text-[11.5px] leading-relaxed text-[#c9d1d9]">
                {(logDep.id === simActiveId.current ? logLines.slice(0, simLogCount) : logLines)
                  .filter((_, idx) => !(logDep.status === "failed" && idx > 8))
                  .map((line, idx) => (
                    <div key={idx}>
                      <span className="mr-3 select-none text-[#8b949e]">{String(idx + 1).padStart(2, "0")}</span>
                      {line}
                    </div>
                  ))}
                {logDep.status === "failed" && (
                  <div className="mt-1 text-[#f85149]">Error: build failed. Missing module "search-client". Fix the import and push again.</div>
                )}
                {logDep.id === simActiveId.current && logDep.status !== "live" && logDep.status !== "failed" && (
                  <div className="mt-1 animate-pulse text-[#8b949e]">…</div>
                )}
              </pre>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Mode switch dialog */}
      <Dialog open={switchTo != null} onOpenChange={(o) => !o && setSwitchTo(null)}>
        <DialogContent className="sm:max-w-[440px]">
          {switchTo && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {switchTo === "bettercms" ? "Move hosting to BetterCMS" : "Switch to external hosting"}
                </DialogTitle>
                <DialogDescription>
                  {switchTo === "bettercms"
                    ? "We connect your GitHub repo, detect the framework, and set up staging and production."
                    : "You take over deploys on your own platform. We keep serving content, APIs and previews."}
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-2">
                {(switchTo === "bettercms"
                  ? [
                      "Staging stays on " + staging + ", production can use your domain.",
                      "API keys and env vars are injected into every build automatically.",
                      "Content, media, SEO and forms do not move.",
                    ]
                  : [
                      "Your rebuild webhook keeps firing on every publish.",
                      "Connect your production and staging URLs so previews keep working.",
                      "Content, media, SEO and forms do not move.",
                    ]
                ).map((line, i, arr) => (
                  <li
                    key={line}
                    className={`flex items-start gap-2 text-[12.5px] leading-relaxed ${
                      i === arr.length - 1 ? "text-status-success" : "text-muted-foreground"
                    }`}
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success" />
                    {line}
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setSwitchTo(null)}
                  className="inline-flex h-9 items-center rounded-[6px] px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (switchTo === "bettercms") {
                      projectActions.setHosting(pr.id, {
                        mode: "bettercms",
                        repo: hosting.repo ?? `flowtrix/${pr.slug}`,
                        branch: hosting.branch ?? "main",
                        rootDir: hosting.rootDir ?? "/",
                        packageManager: hosting.packageManager ?? "bun",
                        nodeVersion: hosting.nodeVersion ?? "20",
                        installCommand: hosting.installCommand ?? "bun install",
                        buildCommand: hosting.buildCommand ?? "bun run build",
                        outputDir: hosting.outputDir ?? ".next",
                        autoDeploy: true,
                      });
                      toast.success("BetterCMS Hosting is on. First deploy is one click away.");
                    } else {
                      projectActions.setHosting(pr.id, {
                        mode: "external",
                        productionUrl: `https://${pr.domain ?? "your-site.com"}`,
                        stagingUrl: "",
                      });
                      toast.success("External hosting is on. Deploys are yours again.");
                    }
                    setSwitchTo(null);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
                >
                  {switchTo === "bettercms" ? "Connect and switch" : "Switch to external"}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

/* ── pieces ── */

function ModeCard({
  active,
  recommended,
  icon: Icon,
  title,
  tagline,
  points,
  onClick,
}: {
  active: boolean;
  recommended?: boolean;
  icon: typeof Server;
  title: string;
  tagline: string;
  points: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col rounded-xl border p-4 text-left transition-colors ${
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-[color:var(--color-border)] bg-[color:var(--s1)] hover:bg-[color:var(--color-row-hover)]"
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-[13.5px] font-semibold text-foreground">{title}</span>
        {recommended && (
          <span className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--status-live-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--status-live-fg)]">
            <Sparkles className="h-3 w-3" /> Recommended
          </span>
        )}
        {active && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-[4px] bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
            <Check className="h-3 w-3" /> Current
          </span>
        )}
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">{tagline}</p>
      <ul className="mt-auto space-y-1">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-status-success" />
            {p}
          </li>
        ))}
      </ul>
    </button>
  );
}

function RepoCard({ hosting, onSave }: { hosting: FrontendHosting; onSave: (h: FrontendHosting) => void }) {
  const [draft, setDraft] = useState(hosting);
  const set = (p: Partial<FrontendHosting>) => setDraft((d) => ({ ...d, ...p }));
  return (
    <div className="rounded-xl border border-[color:var(--border-hairline)] bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--border-hairline)] px-5 py-3.5">
        <Github className="h-4 w-4 shrink-0 text-foreground" />
        <span className="font-mono text-[13px] text-foreground">{draft.repo}</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--s2)] px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          <GitBranch className="h-3 w-3" /> {draft.branch}
        </span>
        <span className="inline-flex items-center rounded-md border border-status-preview/30 bg-status-preview/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-status-preview">
          Next.js · auto detected
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">Auto deploy on push</span>
          <Switch
            checked={draft.autoDeploy ?? true}
            onCheckedChange={(on) => {
              set({ autoDeploy: on });
              onSave({ ...draft, autoDeploy: on });
            }}
            aria-label="Auto deploy on push"
          />
        </div>
      </div>
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        <BuildField label="Install command" value={draft.installCommand ?? ""} onChange={(v) => set({ installCommand: v })} />
        <BuildField label="Build command" value={draft.buildCommand ?? ""} onChange={(v) => set({ buildCommand: v })} />
        <BuildField label="Output directory" value={draft.outputDir ?? ""} onChange={(v) => set({ outputDir: v })} />
        <BuildField label="Root directory" value={draft.rootDir ?? "/"} onChange={(v) => set({ rootDir: v })} />
        <BuildField label="Node version" value={draft.nodeVersion ?? "20"} onChange={(v) => set({ nodeVersion: v })} />
        <BuildField label="Package manager" value={draft.packageManager ?? "bun"} onChange={(v) => set({ packageManager: v as FrontendHosting["packageManager"] })} />
      </div>
      <div className="flex items-center justify-between border-t border-[color:var(--border-hairline)] px-5 py-3">
        <span className="text-[11.5px] text-muted-foreground">Detected from the repo. Overrides apply on the next deploy.</span>
        <Button size="sm" variant="outline" onClick={() => onSave(draft)}>
          Save settings
        </Button>
      </div>
    </div>
  );
}

function BuildField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">{label}</div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 font-mono text-[12px]" />
    </label>
  );
}

function EnvRow({
  label,
  url,
  detail,
  live,
  chip,
  locked,
}: {
  label: string;
  url: string;
  detail: string;
  live: boolean;
  chip: string;
  /** Staging restricted to workspace members. */
  locked?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--border-hairline)] px-5 py-3.5 last:border-b-0 first:border-b">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? "bg-status-success" : "bg-[color:var(--s4)]"}`} />
      <span className="w-24 shrink-0 text-[13px] font-medium text-foreground">{label}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[12.5px] text-foreground">{url}</div>
        <div className="truncate text-[11.5px] text-muted-foreground">{detail}</div>
      </div>
      {locked ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-status-warning/30 bg-status-warning/10 px-1.5 py-0.5 text-[10.5px] font-medium text-status-warning">
          <Lock className="h-3 w-3" /> Members only
        </span>
      ) : (
        <span className="shrink-0 rounded-md border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
          {chip}
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(`https://${url}`);
          toast.success("Link copied");
        }}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        title="Copy link"
      >
        <Copy className="h-3.5 w-3.5" /> Copy
      </button>
      <button
        type="button"
        onClick={() => toast(`Opening https://${url} (demo)`)}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Visit
      </button>
    </div>
  );
}

function ExternalHosting({
  pr,
  workspace,
  project,
  onSwitch,
}: {
  pr: Project;
  workspace: string;
  project: string;
  onSwitch: () => void;
}) {
  const [prod, setProd] = useState(pr.hosting?.productionUrl ?? "");
  const [stagingUrl, setStagingUrl] = useState(pr.hosting?.stagingUrl ?? "");
  return (
    <>
      <Section title="Your URLs" description="Where your deployments live. Previews and the visual editor use these.">
        <div className="rounded-xl border border-[color:var(--border-hairline)] bg-card px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Production URL</div>
              <Input value={prod} onChange={(e) => setProd(e.target.value)} placeholder="https://your-site.com" className="h-9 font-mono text-[12.5px]" />
            </label>
            <label className="block">
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Staging URL</div>
              <Input value={stagingUrl} onChange={(e) => setStagingUrl(e.target.value)} placeholder="https://staging.your-site.com" className="h-9 font-mono text-[12.5px]" />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11.5px] text-muted-foreground">
              Publishing content pings your rebuild webhook. Manage it under{" "}
              <Link
                to={`/w/${workspace}/p/${project}/settings/webhooks` as never}
                className="font-medium text-primary hover:underline"
              >
                Webhooks
              </Link>
              .
            </span>
            <Button size="sm" variant="outline" onClick={() => toast.success("URLs saved")}>
              Save
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Prefer fewer moving parts?" description="One vendor for CMS and hosting, with staging built in.">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)] px-5 py-4">
          <div className="text-[12.5px] leading-relaxed text-foreground/85">
            BetterCMS Hosting builds from your GitHub repo, gives you{" "}
            <span className="font-mono text-[12px]">{pr.slug}.bettercms.site</span> for staging, branch previews, and
            one-click rollbacks. Your APIs and keys are wired in for you.
          </div>
          <Button size="sm" className="gap-1.5" onClick={onSwitch}>
            <Server className="h-3.5 w-3.5" /> Move hosting to BetterCMS
          </Button>
        </div>
      </Section>
    </>
  );
}
