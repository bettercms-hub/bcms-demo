import { cn } from "@/lib/utils";

interface Props {
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (v: string) => void;
  className?: string;
}

export function ChipGroup({ value, options, labels, onChange, className }: Props) {
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-7 min-w-9 items-center justify-center rounded-full border px-2.5 text-[11px] font-medium uppercase tracking-wide transition-colors",
              active
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {labels?.[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}
