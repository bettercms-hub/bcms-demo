import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CloudCog,
  Code2,
  Copy,
  ExternalLink,
  Github,
  LayoutTemplate,
  Loader2,
  Rocket,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { projectActions } from "@/lib/cms/store";
import type { Project, ProjectFramework, ProjectKind } from "@/lib/cms/types";
import { StackIcon, type StackKey } from "@/components/cms/icons/StackIcon";

type Step = "type" | "source" | "configure" | "creating" | "done";
type Source = "github" | "zip" | "template";

const FRAMEWORKS: { key: ProjectFramework; label: string }[] = [
  { key: "nextjs", label: "Next.js" },
  { key: "astro", label: "Astro" },
  { key: "nuxt", label: "Nuxt" },
  { key: "sveltekit", label: "SvelteKit" },
  { key: "other", label: "Other" },
];

const TEMPLATES: { id: string; name: string; framework: ProjectFramework; desc: string }[] = [
  { id: "astro-blog", name: "Astro Blog", framework: "astro", desc: "Content-first blog starter." },
  { id: "next-marketing", name: "Next.js Marketing", framework: "nextjs", desc: "Landing & marketing pages." },
  { id: "next-commerce", name: "Next.js Commerce", framework: "nextjs", desc: "Headless storefront." },
  { id: "astro-docs", name: "Astro Docs", framework: "astro", desc: "Documentation site." },
];

function copy(text: string, label = "Copied to clipboard") {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(label),
    () => toast.error("Couldn't copy"),
  );
}

export function NewProjectWizard({
  open,
  onOpenChange,
  workspaceId,
  workspaceSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceSlug: string;
}) {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("type");
  const [kind, setKind] = useState<ProjectKind | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [name, setName] = useState("");
  const [framework, setFramework] = useState<ProjectFramework>("nextjs");
  const [template, setTemplate] = useState<string | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [repo, setRepo] = useState<string | null>(null);
  const [zipName, setZipName] = useState<string | null>(null);
  const [created, setCreated] = useState<Project | null>(null);
  const [progress, setProgress] = useState(0);

  // Fresh state each time the wizard opens.
  useEffect(() => {
    if (!open) return;
    setStep("type");
    setKind(null);
    setSource(null);
    setName("");
    setFramework("nextjs");
    setTemplate(null);
    setGithubConnected(false);
    setRepo(null);
    setZipName(null);
    setCreated(null);
    setProgress(0);
  }, [open]);

  const createSteps = useMemo(() => {
    if (kind === "managed") {
      const bring =
        source === "github" ? "Linking repository" : source === "zip" ? "Uploading files" : "Cloning template";
      return ["Creating project", bring, "Provisioning cloud hosting", "Running first build"];
    }
    return ["Creating project", "Generating content API", "Issuing API keys"];
  }, [kind, source]);

  // Provisioning animation → done.
  useEffect(() => {
    if (step !== "creating") return;
    setProgress(0);
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      setProgress(i);
      if (i >= createSteps.length) {
        clearInterval(iv);
        setTimeout(() => setStep("done"), 450);
      }
    }, 460);
    return () => clearInterval(iv);
  }, [step, createSteps.length]);

  function handleCreate() {
    const n = name.trim();
    if (!n || !kind) return;
    const p = projectActions.create({
      workspaceId,
      name: n,
      kind,
      framework,
      source: source ?? undefined,
      repo: repo ?? (zipName ?? undefined),
    });
    setCreated(p);
    setStep("creating");
  }

  function openProject() {
    if (!created) return;
    onOpenChange(false);
    navigate({ to: "/w/$workspace/p/$project", params: { workspace: workspaceSlug, project: created.slug } });
  }

  const wide = step === "type" || step === "source";
  const eyebrow =
    step === "type"
      ? "New project"
      : kind === "headless"
        ? "Headless CMS"
        : "BetterCMS Cloud";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={wide ? "sm:max-w-[720px]" : "sm:max-w-[560px]"}>
        <div className="mb-1 flex items-center gap-2">
          {(step === "source" || step === "configure") && (
            <button
              type="button"
              onClick={() => setStep(step === "source" ? "type" : kind === "managed" ? "source" : "type")}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </span>
        </div>

        {step === "type" && <TypeStep onPick={(k) => { setKind(k); setStep(k === "managed" ? "source" : "configure"); }} />}
        {step === "source" && <SourceStep onPick={(s) => { setSource(s); setStep("configure"); }} />}
        {step === "configure" && (
          <ConfigureStep
            kind={kind!}
            source={source}
            name={name}
            setName={setName}
            framework={framework}
            setFramework={setFramework}
            template={template}
            setTemplate={(id) => {
              setTemplate(id);
              const t = TEMPLATES.find((x) => x.id === id);
              if (t) {
                setFramework(t.framework);
                if (!name.trim()) setName(t.name);
              }
            }}
            githubConnected={githubConnected}
            onConnectGithub={() => {
              setGithubConnected(true);
              toast.success("GitHub connected");
            }}
            repo={repo}
            setRepo={(r) => {
              setRepo(r);
              if (!name.trim() && r) setName(r.split("/").pop() ?? r);
            }}
            zipName={zipName}
            setZipName={(z) => {
              setZipName(z);
              if (!name.trim() && z) setName(z.replace(/\.zip$/i, ""));
            }}
            onCreate={handleCreate}
          />
        )}
        {step === "creating" && <CreatingStep name={name} steps={createSteps} progress={progress} />}
        {step === "done" && created && (
          <DoneStep project={created} onOpen={openProject} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Step 1: choose type ── */

function TypeStep({ onPick }: { onPick: (kind: ProjectKind) => void }) {
  return (
    <div>
      <DialogTitle className="text-[19px]">How do you want to build?</DialogTitle>
      <DialogDescription className="mt-1">
        Pick how BetterCMS fits your project. You can add another project of either kind later.
      </DialogDescription>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <TypeCard
          icon={Code2}
          title="Headless CMS"
          desc="Model content here and pull it into your own codebase over an API. You build, deploy, and host the site yourself."
          bullets={["Content Delivery API + SDKs", "Use any framework or stack", "You keep your own hosting"]}
          onClick={() => onPick("headless")}
        />
        <TypeCard
          icon={CloudCog}
          title="BetterCMS Cloud"
          badge="Managed"
          highlight
          desc="Bring your code from GitHub or a ZIP, or start from a template. We build, host, publish, and handle SEO — all in one place."
          bullets={["Hosting + continuous deploys", "Visual editor & one-click publish", "Technical SEO handled for you"]}
          onClick={() => onPick("managed")}
        />
      </div>
    </div>
  );
}

function TypeCard({
  icon: Icon,
  title,
  desc,
  bullets,
  badge,
  highlight,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  bullets: string[];
  badge?: string;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col rounded-xl border p-4 text-left transition-all duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        highlight
          ? "border-primary/40 bg-[color:color-mix(in_oklab,var(--primary)_4%,transparent)] hover:border-primary/60"
          : "border-[color:var(--color-border)] bg-[color:var(--card)] hover:border-[color:var(--color-border-strong)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`grid h-10 w-10 place-items-center rounded-lg ${
            highlight ? "bg-primary text-primary-foreground" : "bg-[color:var(--s2)] text-foreground"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.9} />
        </span>
        {badge && (
          <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3 text-[14.5px] font-semibold tracking-tight text-foreground">{title}</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{desc}</p>
      <ul className="mt-3 space-y-1.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-1.5 text-[12px] text-foreground/85">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
            {b}
          </li>
        ))}
      </ul>
      <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Continue <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

/* ── Step 2 (managed): bring your code ── */

function SourceStep({ onPick }: { onPick: (s: Source) => void }) {
  return (
    <div>
      <DialogTitle className="text-[19px]">Bring your site</DialogTitle>
      <DialogDescription className="mt-1">
        Connect your code and we'll build, host, and keep it deployed.
      </DialogDescription>
      <div className="mt-5 space-y-2.5">
        <SourceRow
          icon={Github}
          title="Connect GitHub"
          desc="Import an existing repo or create a new one. Every push auto-deploys."
          badge="Recommended"
          onClick={() => onPick("github")}
        />
        <SourceRow
          icon={UploadCloud}
          title="Upload a ZIP"
          desc="Drop your site's code or build output. Re-upload anytime to update."
          onClick={() => onPick("zip")}
        />
        <SourceRow
          icon={LayoutTemplate}
          title="Start from a template"
          desc="Launch from an Astro or Next.js starter, pre-wired to your content."
          onClick={() => onPick("template")}
        />
      </div>
    </div>
  );
}

function SourceRow({
  icon: Icon,
  title,
  desc,
  badge,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] p-3.5 text-left transition-colors hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-foreground">
        <Icon className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-foreground">{title}</span>
          {badge && (
            <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary">
              {badge}
            </span>
          )}
        </div>
        <div className="text-[12px] text-muted-foreground">{desc}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

/* ── Step 3: configure ── */

function ConfigureStep(props: {
  kind: ProjectKind;
  source: Source | null;
  name: string;
  setName: (v: string) => void;
  framework: ProjectFramework;
  setFramework: (f: ProjectFramework) => void;
  template: string | null;
  setTemplate: (id: string) => void;
  githubConnected: boolean;
  onConnectGithub: () => void;
  repo: string | null;
  setRepo: (r: string) => void;
  zipName: string | null;
  setZipName: (z: string) => void;
  onCreate: () => void;
}) {
  const { kind, source } = props;
  const managed = kind === "managed";
  const ready =
    props.name.trim().length > 0 &&
    (!managed ||
      (source === "github" ? props.githubConnected && !!props.repo : source === "zip" ? !!props.zipName : !!props.template));

  const title = !managed
    ? "Set up your headless project"
    : source === "github"
      ? "Connect your repository"
      : source === "zip"
        ? "Upload your site"
        : "Choose a template";

  return (
    <div>
      <DialogTitle className="text-[19px]">{title}</DialogTitle>
      <DialogDescription className="mt-1">
        {managed
          ? "We'll build and host this on BetterCMS Cloud."
          : "Model content here and connect it to your codebase."}
      </DialogDescription>

      <div className="mt-5 space-y-5">
        {/* source-specific */}
        {managed && source === "github" && <GithubBlock {...props} />}
        {managed && source === "zip" && <ZipBlock zipName={props.zipName} setZipName={props.setZipName} />}
        {managed && source === "template" && <TemplateBlock template={props.template} setTemplate={props.setTemplate} />}

        {/* name */}
        <Field label="Project name">
          <Input
            autoFocus={!managed}
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder="e.g. Acme Marketing"
            maxLength={48}
          />
        </Field>

        {/* framework (hidden for template, which sets it) */}
        {!(managed && source === "template") && (
          <Field label={managed ? "Framework" : "Which framework will you use?"}>
            <FrameworkPicker value={props.framework} onChange={props.setFramework} />
          </Field>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={props.onCreate}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_2px_8px_-2px_rgba(239,3,127,0.4)] transition-all hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:shadow-none"
        >
          {managed ? "Create & deploy" : "Create project"}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[12px] font-medium text-foreground">{label}</div>
      {children}
    </label>
  );
}

function FrameworkPicker({ value, onChange }: { value: ProjectFramework; onChange: (f: ProjectFramework) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FRAMEWORKS.map((f) => {
        const active = value === f.key;
        const isStack = f.key === "nextjs" || f.key === "astro";
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors ${
              active
                ? "border-primary/50 bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-foreground"
                : "border-[color:var(--color-border)] bg-[color:var(--card)] text-muted-foreground hover:border-[color:var(--color-border-strong)] hover:text-foreground"
            }`}
          >
            {isStack && <StackIcon stack={f.key as StackKey} className="h-4 w-4 text-foreground" />}
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

function GithubBlock(props: {
  githubConnected: boolean;
  onConnectGithub: () => void;
  repo: string | null;
  setRepo: (r: string) => void;
}) {
  const REPOS = ["acme/marketing-site", "acme/docs", "acme/storefront", "acme/blog"];
  if (!props.githubConnected) {
    return (
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--s2)] p-5 text-center">
        <Github className="mx-auto h-7 w-7 text-foreground" />
        <div className="mt-2 text-[13px] font-medium text-foreground">Connect your GitHub account</div>
        <div className="mx-auto mt-1 max-w-xs text-[12px] text-muted-foreground">
          Authorize BetterCMS to import a repo and set up auto-deploys. Credentials are never stored.
        </div>
        <button
          type="button"
          onClick={props.onConnectGithub}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
        >
          <Github className="h-4 w-4" /> Connect GitHub
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" /> Connected as <span className="font-medium">@acme</span>
      </div>
      <Field label="Repository">
        <div className="space-y-1.5">
          {REPOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => props.setRepo(r)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors ${
                props.repo === r
                  ? "border-primary/50 bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-foreground"
                  : "border-[color:var(--color-border)] bg-[color:var(--card)] text-foreground hover:bg-[color:var(--color-row-hover)]"
              }`}
            >
              <Github className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 font-mono text-[12.5px]">{r}</span>
              {props.repo === r && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function ZipBlock({ zipName, setZipName }: { zipName: string | null; setZipName: (z: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => setZipName("site-export.zip")}
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-7 text-center transition-colors ${
        zipName
          ? "border-primary/50 bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]"
          : "border-[color:var(--color-border-strong)] bg-[color:var(--s2)] hover:border-primary/50"
      }`}
    >
      <UploadCloud className="h-7 w-7 text-muted-foreground" />
      {zipName ? (
        <div className="text-[13px] font-medium text-foreground">{zipName}</div>
      ) : (
        <>
          <div className="text-[13px] font-medium text-foreground">Drop your ZIP here</div>
          <div className="text-[12px] text-muted-foreground">or click to browse · up to 100 MB</div>
        </>
      )}
    </button>
  );
}

function TemplateBlock({ template, setTemplate }: { template: string | null; setTemplate: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {TEMPLATES.map((t) => {
        const active = template === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplate(t.id)}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
              active
                ? "border-primary/50 bg-[color:color-mix(in_oklab,var(--primary)_6%,transparent)]"
                : "border-[color:var(--color-border)] bg-[color:var(--card)] hover:border-[color:var(--color-border-strong)]"
            }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-md bg-[color:var(--s2)] text-foreground">
              <StackIcon stack={t.framework === "astro" ? "astro" : "nextjs"} className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[13px] font-semibold text-foreground">{t.name}</div>
              <div className="text-[11.5px] text-muted-foreground">{t.desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── Step 4: provisioning ── */

function CreatingStep({ name, steps, progress }: { name: string; steps: string[]; progress: number }) {
  return (
    <div className="py-2">
      <DialogTitle className="text-[19px]">Setting up “{name}”</DialogTitle>
      <DialogDescription className="mt-1">This only takes a moment.</DialogDescription>
      <ul className="mt-5 space-y-2.5">
        {steps.map((s, i) => {
          const done = i < progress;
          const active = i === progress;
          return (
            <li key={s} className="flex items-center gap-2.5 text-[13px]">
              <span
                className={`grid h-5 w-5 place-items-center rounded-full transition-colors ${
                  done ? "bg-emerald-500/15 text-emerald-500" : active ? "text-primary" : "text-muted-foreground/50"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={done || active ? "text-foreground" : "text-muted-foreground"}>{s}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Step 5: done ── */

function DoneStep({ project, onOpen, onClose }: { project: Project; onOpen: () => void; onClose: () => void }) {
  const managed = project.kind === "managed";
  const url = `${project.slug}.bettercms.site`;
  const apiEndpoint = `https://api.bettercms.site/v1/${project.id}`;
  const token = `bcms_live_${project.id.replace(/[^a-z0-9]/gi, "")}k2p8`;
  const snippet =
    project.framework === "astro"
      ? `const res = await fetch(\n  "${apiEndpoint}/content",\n  { headers: { Authorization: "Bearer ${token}" } }\n);`
      : `const res = await fetch("${apiEndpoint}/content", {\n  headers: { Authorization: \`Bearer \${process.env.BCMS_TOKEN}\` },\n});`;

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
          {managed ? <Rocket className="h-5 w-5" /> : <Check className="h-5 w-5" strokeWidth={2.5} />}
        </span>
        <div>
          <DialogTitle className="text-[18px]">
            {managed ? "Your site is live 🎉" : "Your project is ready 🎉"}
          </DialogTitle>
          <DialogDescription>
            {managed ? "Built and deployed on BetterCMS Cloud." : "Content API provisioned and ready to query."}
          </DialogDescription>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {managed ? (
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-3 py-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="flex-1 truncate font-mono text-[12.5px] text-foreground">{url}</span>
            <CopyBtn text={`https://${url}`} />
            <a
              href={`https://${url}`}
              target="_blank"
              rel="noreferrer"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              title="Visit site"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : (
          <>
            <Row label="API endpoint" value={apiEndpoint} />
            <Row label="Project token" value={token} mono secret />
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Fetch your content
              </div>
              <pre className="overflow-x-auto rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] p-3 text-[11.5px] leading-relaxed text-foreground">
                <code>{snippet}</code>
              </pre>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        >
          Done
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
        >
          {managed ? "Open editor" : "Open schema editor"} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, mono, secret }: { label: string; value: string; mono?: boolean; secret?: boolean }) {
  const [show, setShow] = useState(!secret);
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-3 py-2">
        <span className={`flex-1 truncate text-[12.5px] text-foreground ${mono ? "font-mono" : ""}`}>
          {show ? value : "•".repeat(Math.min(28, value.length))}
        </span>
        {secret && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            {show ? "Hide" : "Reveal"}
          </button>
        )}
        <CopyBtn text={value} />
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      title="Copy"
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}
