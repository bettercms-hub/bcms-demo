import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required for accessibility — also used as tooltip text. */
  label: string;
  /** Optional dot/badge overlay (e.g. unread indicator). */
  indicator?: ReactNode;
  active?: boolean;
}

/**
 * Shared 28px utility icon button used by the global top bar (notifications,
 * help, settings, user menu trigger, etc). All utility actions render through
 * this primitive so sizing, hover, focus, and active states stay identical.
 */
export const UtilityIconButton = forwardRef<HTMLButtonElement, Props>(function UtilityIconButton(
  { label, indicator, active, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      data-active={active ? "" : undefined}
      className={[
        "relative grid h-8 w-8 place-items-center rounded-md text-muted-foreground",
        "transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
        "data-[active]:bg-[color:var(--color-row-selected)] data-[active]:text-foreground",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
      {indicator}
    </button>
  );
});
