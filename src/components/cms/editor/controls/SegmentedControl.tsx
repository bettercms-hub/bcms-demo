import { cn } from "@/lib/utils";

interface Props {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  labels?: Record<string, string>;
  className?: string;
}

export function SegmentedControl({ value, options, onChange, labels, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-md bg-muted p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-7 min-w-7 items-center justify-center rounded-sm px-2.5 text-[12px] font-medium transition-colors",
              active
                ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {labels?.[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}
