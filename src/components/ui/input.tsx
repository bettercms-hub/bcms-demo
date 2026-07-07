import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Transparent default → subtle tint on hover → raised + pink border on focus.
          "flex h-9 w-full rounded-lg border border-border bg-transparent px-3 text-[13px] text-foreground transition-[background-color,border-color,box-shadow] duration-[120ms] ease-out placeholder:text-muted-foreground hover:bg-[var(--row-hover)]/40 focus-visible:outline-none focus-visible:border-primary focus-visible:bg-[var(--surface-focused)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
