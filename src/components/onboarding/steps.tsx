/**
 * Onboarding steps — the shared pieces behind /onboarding and /workspace/new.
 *
 * Design rules, senior-designer edition:
 * - One question per screen, big targets, click advances (no Next button on
 *   choice steps). Number keys 1-9 select. Enter submits inputs.
 * - Progress dots, a quiet back arrow, skip only where skipping is honest.
 * - Answers echo forward: the workspace step speaks agency when you said
 *   client work, the invite step stays optional for solo founders.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/cms/shell/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------- shell */

export function OnboardingShell({
  step,
  stepCount,
  onBack,
  onClose,
  children,
}: {
  step: number;
  stepCount: number;
  onBack?: () => void;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center px-5">
        <div className="flex w-24 items-center">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Logo className="h-6 w-auto" />
          )}
        </div>
        <div className="flex flex-1 items-center justify-center gap-1.5" aria-label={`Step ${step + 1} of ${stepCount}`}>
          {Array.from({ length: stepCount }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-5 bg-primary" : i < step ? "w-1.5 bg-primary/50" : "w-1.5 bg-[color:var(--color-border)]",
              )}
            />
          ))}
        </div>
        <div className="flex w-24 items-center justify-end">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>
      <main className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-5 pb-16 pt-[9vh]">
        <div key={step} className="w-full max-w-[560px] animate-in fade-in slide-in-from-bottom-2 duration-300">{children}</div>
      </main>
    </div>
  );
}

export function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-7 text-center">
      <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/* ------------------------------------------------------------ choice step */

export interface Choice<T extends string> {
  id: T;
  label: string;
  blurb?: string;
  icon?: LucideIcon;
}

export function ChoiceStep<T extends string>({
  title,
  subtitle,
  choices,
  selected,
  columns = 2,
  onPick,
}: {
  title: string;
  subtitle: string;
  choices: Choice<T>[];
  selected?: T;
  columns?: 2 | 3;
  onPick: (id: T) => void;
}) {
  const [picked, setPicked] = useState<T | undefined>(selected);

  // Number keys pick options, the fastest path for keyboard users.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) pick(choices[n - 1].id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices]);

  function pick(id: T) {
    setPicked(id);
    // A beat of selected-state feedback before the step advances.
    setTimeout(() => onPick(id), 180);
  }

  return (
    <div>
      <StepHeading title={title} subtitle={subtitle} />
      <div className={cn("grid gap-2.5", columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
        {choices.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(c.id)}
            className={cn(
              "group relative rounded-xl border p-4 text-left transition-all",
              picked === c.id
                ? "border-[color:color-mix(in_oklab,var(--primary)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_6%,transparent)] shadow-sm"
                : "border-[color:var(--color-border)] bg-card hover:border-[color:var(--color-border-strong)] hover:shadow-sm",
            )}
          >
            {c.icon && (
              <span
                className={cn(
                  "mb-2.5 grid h-9 w-9 place-items-center rounded-lg transition-colors",
                  picked === c.id ? "bg-primary text-primary-foreground" : "bg-[color:var(--s2)] text-muted-foreground group-hover:text-foreground",
                )}
              >
                <c.icon className="h-[18px] w-[18px]" />
              </span>
            )}
            <span className="block text-[13.5px] font-semibold text-foreground">{c.label}</span>
            {c.blurb && <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">{c.blurb}</span>}
            <kbd className="absolute right-3 top-3 hidden rounded border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70 sm:block">
              {i + 1}
            </kbd>
            {picked === c.id && (
              <span className="absolute bottom-3 right-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- workspace step */

export function slugPreview(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace"
  );
}

export function WorkspaceStep({
  title,
  subtitle,
  initialName,
  ctaLabel,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  initialName?: string;
  ctaLabel: string;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const valid = name.trim().length >= 2;

  return (
    <div className="mx-auto max-w-[440px]">
      <StepHeading title={title} subtitle={subtitle} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(name.trim());
        }}
      >
        <label className="block">
          <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Workspace name</div>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc"
            className="h-11 w-full rounded-lg border border-[color:var(--color-border)] bg-card px-3 text-[14px] outline-none transition-colors focus:border-[color:var(--primary)]"
          />
        </label>

        {/* live identity preview: how the workspace reads in the app */}
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3.5 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-[13px] font-bold text-background">
            {(name.trim()[0] ?? "A").toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-foreground">{name.trim() || "Your workspace"}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">app.bettercms.site/w/{slugPreview(name)}</div>
          </div>
        </div>

        <Button type="submit" disabled={!valid} className="mt-5 h-10 w-full text-[13.5px]">
          {ctaLabel} <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
        <p className="mt-2.5 text-center text-[11px] text-muted-foreground">Starts on the Free plan. You can rename it anytime in settings.</p>
      </form>
    </div>
  );
}

/* ----------------------------------------------------------- invite step */

export function InviteStep({
  workspaceName,
  onFinish,
}: {
  workspaceName: string;
  onFinish: (emails: string[]) => void;
}) {
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const validDraft = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.trim());

  function add() {
    const e = draft.trim().toLowerCase();
    if (!validDraft || emails.includes(e)) return;
    setEmails((xs) => [...xs, e]);
    setDraft("");
  }

  return (
    <div className="mx-auto max-w-[440px]">
      <StepHeading
        title={`Who works with you on ${workspaceName}?`}
        subtitle="Teammates get an email invite and pick their own password. Roles are set per member afterwards."
      />
      <div
        className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-card px-2 py-1.5 transition-colors focus-within:border-[color:var(--primary)]"
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((e) => (
          <span key={e} className="inline-flex items-center gap-1 rounded-md bg-[color:color-mix(in_oklab,var(--primary)_9%,transparent)] py-0.5 pl-2 pr-1 text-[12px] font-medium text-primary">
            {e}
            <button type="button" aria-label={`Remove ${e}`} onClick={() => setEmails((xs) => xs.filter((x) => x !== e))} className="grid h-4 w-4 place-items-center rounded hover:bg-primary/15">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === " ") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && draft === "" && emails.length > 0) {
              setEmails((xs) => xs.slice(0, -1));
            }
          }}
          onBlur={add}
          placeholder={emails.length === 0 ? "teammate@company.com" : "Add another"}
          className="h-7 min-w-[160px] flex-1 bg-transparent px-1 text-[13px] outline-none"
          type="email"
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">Press Enter after each address.</p>

      <Button className="mt-5 h-10 w-full text-[13.5px]" onClick={() => onFinish(emails)}>
        {emails.length > 0 ? `Send ${emails.length} ${emails.length === 1 ? "invite" : "invites"} and open workspace` : "Open my workspace"}
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
      {emails.length === 0 && (
        <button type="button" onClick={() => onFinish([])} className="mt-3 block w-full text-center text-[12px] text-muted-foreground transition-colors hover:text-foreground">
          I will invite people later
        </button>
      )}
    </div>
  );
}
