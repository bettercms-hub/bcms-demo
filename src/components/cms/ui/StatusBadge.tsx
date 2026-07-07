import type { PublishState, MemberStatus, DomainStatus, EnvScope } from "@/lib/cms/types";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-foreground border-border",
  muted:   "bg-muted/60 text-muted-foreground border-border",
  info:    "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  danger:  "bg-destructive/10 text-destructive border-destructive/20",
};

interface BaseProps {
  label?: string;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ label, tone = "neutral", dot, className = "" }: BaseProps) {
  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 rounded border px-2 text-[10.5px] font-medium uppercase tracking-wider ${TONE_CLASSES[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}

// ---- Mappers ----

const PUBLISH_TONE: Record<PublishState, StatusTone> = {
  draft: "muted",
  review: "warning",
  approved: "info",
  scheduled: "info",
  published: "success",
  archived: "neutral",
};

export function PublishBadge({ state }: { state?: PublishState }) {
  if (!state) return null;
  return <StatusBadge label={state} tone={PUBLISH_TONE[state]} dot />;
}

const MEMBER_TONE: Record<NonNullable<MemberStatus>, StatusTone> = {
  active: "success",
  invited: "info",
  suspended: "danger",
};

export function MemberStatusBadge({ status }: { status?: MemberStatus }) {
  if (!status) return null;
  return <StatusBadge label={status} tone={MEMBER_TONE[status]} />;
}

const DOMAIN_TONE: Record<DomainStatus, StatusTone> = {
  active: "success",
  verifying: "warning",
  pending: "info",
  failed: "danger",
};

export function DomainStatusBadge({ status }: { status: DomainStatus }) {
  return <StatusBadge label={status} tone={DOMAIN_TONE[status]} />;
}

const ENV_TONE: Record<EnvScope, StatusTone> = {
  dev: "info",
  prod: "success",
  all: "neutral",
};

export function EnvScopeBadge({ scope }: { scope: EnvScope }) {
  return <StatusBadge label={scope} tone={ENV_TONE[scope]} />;
}

export function HttpStatusBadge({ code }: { code: number }) {
  const tone: StatusTone = code >= 500 ? "danger" : code >= 400 ? "warning" : "success";
  return <StatusBadge label={String(code)} tone={tone} />;
}

export function InvoiceStatusBadge({ status }: { status: "paid" | "open" | "void" | "failed" }) {
  const map = {
    paid: "success",
    open: "warning",
    failed: "danger",
    void: "muted",
  } as const;
  return <StatusBadge label={status} tone={map[status]} />;
}
