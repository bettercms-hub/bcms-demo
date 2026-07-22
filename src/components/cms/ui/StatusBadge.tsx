import type { PublishState, MemberStatus, DomainStatus, EnvScope } from "@/lib/cms/types";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-[color:var(--s3)] text-[color:var(--foreground-secondary)] border-transparent",
  muted:   "bg-[color:var(--status-draft-bg)] text-[color:var(--status-draft-fg)] border-transparent",
  info:    "bg-[color:var(--status-review-bg)] text-[color:var(--status-review-fg)] border-transparent",
  success: "bg-[color:var(--status-live-bg)] text-[color:var(--status-live-fg)] border-transparent",
  warning: "bg-[color-mix(in_srgb,var(--status-warning)_14%,transparent)] text-[color:var(--status-warning)] border-transparent",
  danger:  "bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] text-[color:var(--destructive)] border-transparent",
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
      className={`inline-flex h-5 items-center gap-1.5 rounded-[4px] border px-1.5 text-[11.5px] font-medium capitalize ${TONE_CLASSES[tone]} ${className}`}
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
