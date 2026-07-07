import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}

export function Stepper({ value, onChange, min, max, step = 1, suffix, className }: Props) {
  const v = typeof value === "number" ? value : 0;
  const dec = () => {
    const next = v - step;
    if (min !== undefined && next < min) return;
    onChange(next);
  };
  const inc = () => {
    const next = v + step;
    if (max !== undefined && next > max) return;
    onChange(next);
  };
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center overflow-hidden rounded-md border border-border bg-surface",
        className,
      )}
    >
      <button
        type="button"
        onClick={dec}
        className="grid h-full w-7 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Decrease"
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
        className="h-full w-12 bg-transparent text-center text-[13px] text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix && (
        <span className="pr-2 text-[11px] text-muted-foreground">{suffix}</span>
      )}
      <button
        type="button"
        onClick={inc}
        className="grid h-full w-7 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Increase"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
