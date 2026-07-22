import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // V2: card fill, 8px radius; focus = strong border + soft coral halo.
          "flex h-10 w-full rounded-[8px] border border-border bg-card px-3 text-[13px] text-foreground transition-[background-color,border-color,box-shadow] duration-[120ms] ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-border-strong focus-visible:shadow-[var(--shadow-focus)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
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
