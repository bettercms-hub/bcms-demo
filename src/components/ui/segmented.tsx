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
  const inner = size === "sm" ? "h-6 px-2.5 text-[12px]" : "h-7 px-3 text-[12px]";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[8px] bg-[var(--s2)] p-1 shadow-[var(--shadow-seg-track)]",
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
              "inline-flex items-center gap-1.5 rounded-[6px] font-medium transition-colors duration-[120ms]",
              inner,
              active
                ? "bg-card border border-border text-foreground shadow-[var(--shadow-seg)]"
                : "text-muted-foreground hover:text-foreground",
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
