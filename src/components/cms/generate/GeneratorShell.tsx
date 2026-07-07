/**
 * GeneratorShell — shared chrome for the generator wizards: portal, backdrop,
 * header with step dots, footer slot. Matches the PageSettingsDialog look.
 */
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function GeneratorShell({
  icon: Icon,
  title,
  subtitle,
  step,
  stepCount,
  onClose,
  children,
  footer,
  wide,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  step: number;
  stepCount: number;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute left-1/2 top-[7vh] flex max-h-[86vh] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] text-foreground shadow-2xl",
          wide ? "w-[min(640px,calc(100vw-24px))]" : "w-[min(560px,calc(100vw-24px))]",
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">{title}</div>
            <div className="truncate text-[11.5px] text-muted-foreground">{subtitle}</div>
          </div>
          {stepCount > 1 && (
            <div className="mr-1 flex items-center gap-1" aria-label={`Step ${step + 1} of ${stepCount}`}>
              {Array.from({ length: stepCount }, (_, i) => (
                <span
                  key={i}
                  className={cn("h-1.5 rounded-full transition-all", i === step ? "w-4 bg-primary" : "w-1.5 bg-[color:var(--color-border)]")}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

        {footer && <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function GenField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-muted-foreground/80">{hint}</div>}
    </label>
  );
}

export const genInput =
  "h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]";
