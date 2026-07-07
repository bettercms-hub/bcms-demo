import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  options: { value: string; icon: LucideIcon; label: string }[];
  onChange: (v: string) => void;
  className?: string;
}

export function IconToggleGroup({ value, options, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-md bg-muted p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={active}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-sm transition-colors",
              active
                ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
