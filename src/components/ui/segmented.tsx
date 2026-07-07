import * as React from "react";
import { cn } from "@/lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  className?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: SegmentedProps<T>) {
  const h = size === "sm" ? "h-8" : "h-9";
  const inner = size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[12px]";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-transparent p-0.5",
        h,
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
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors duration-[120ms]",
              inner,
              active
                ? "bg-[var(--s3)] text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-[var(--s4)]/60",
            )}
            aria-pressed={active}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
