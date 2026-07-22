/**
 * Shared building blocks for the account settings pages — labelled inputs,
 * buttons and helpers reused across Profile, Security, Email and Connections.
 */
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export function initialsOf(name: string): string {
  return (
    name
      .split(/[\s.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline gap-2">
      <span className="text-[12px] font-medium text-foreground">{children}</span>
      {hint && <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-[8px] border border-[color:var(--color-border)] bg-[color:var(--card)] px-3 text-[13px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-[color:var(--border-strong)] focus:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Field({
  label,
  hint,
  children,
  error,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <Label hint={hint}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-[11.5px] text-destructive">{error}</p>}
    </label>
  );
}

export function PrimaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] active:bg-[var(--primary-pressed)] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function GhostButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] border border-[color:var(--color-border)] bg-[color:var(--card)] px-3.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--color-row-hover)] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function DangerButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] border border-[color:color-mix(in_oklab,var(--destructive)_35%,transparent)] bg-[color:var(--card)] px-3.5 text-[12.5px] font-medium text-destructive transition-colors hover:bg-[color:color-mix(in_oklab,var(--destructive)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

/** Demo notice — makes clear these flows are a front-end simulation. */
export function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-dashed border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
