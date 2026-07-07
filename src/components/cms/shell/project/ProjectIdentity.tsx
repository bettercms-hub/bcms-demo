interface Props {
  name: string;
  environment?: string;
  status?: "published" | "draft" | "scheduled" | "archived" | string;
}

const STATUS_DOT: Record<string, string> = {
  published: "bg-emerald-400",
  draft: "bg-muted-foreground/60",
  scheduled: "bg-amber-400",
  archived: "bg-muted-foreground/40",
};

export function ProjectIdentity({ name, environment = "Production", status = "draft" }: Props) {
  const initial = name[0]?.toUpperCase() ?? "?";
  const dot = STATUS_DOT[status] ?? "bg-muted-foreground/60";

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-[5px] border border-border bg-[color:var(--s3)] text-[10.5px] font-semibold uppercase text-foreground">
        {initial}
      </div>
      <div className="min-w-0 truncate text-[13.5px] font-semibold tracking-tight text-foreground">
        {name}
      </div>
      <div className="hidden items-center gap-1.5 rounded-md border border-border bg-[color:var(--color-elevated)] px-1.5 py-0.5 text-[10.5px] text-muted-foreground sm:flex">
        {environment}
      </div>
      <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="capitalize">{status}</span>
      </div>
    </div>
  );
}
