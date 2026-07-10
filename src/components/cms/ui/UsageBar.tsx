interface Props {
  value: number;
  limit: number;
  label?: string;
  unit?: string;
  format?: (n: number) => string;
  showPercent?: boolean;
  size?: "sm" | "md";
}

export function UsageBar({ value, limit, label, unit, format, showPercent = true, size = "md" }: Props) {
  const pct = Math.min(100, Math.round((value / Math.max(1, limit)) * 100));
  // Usage is never shown in red: escalate through amber, never destructive.
  const tone =
    pct >= 90 ? "bg-amber-600" : pct >= 70 ? "bg-amber-500" : "bg-primary";
  const fmt = (n: number) => (format ? format(n) : n.toLocaleString());
  const h = size === "sm" ? "h-1" : "h-1.5";

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="mb-1.5 flex items-baseline justify-between">
          {label && <span className="text-[12px] font-medium text-foreground">{label}</span>}
          {showPercent && <span className="text-[11.5px] tabular-nums text-muted-foreground">{pct}%</span>}
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-muted ${h}`}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">
        {fmt(value)}{unit ? ` ${unit}` : ""} of {fmt(limit)}{unit ? ` ${unit}` : ""}
      </div>
    </div>
  );
}
