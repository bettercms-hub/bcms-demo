import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[72px] w-full rounded-lg border border-border bg-transparent px-3 py-2 text-[13px] text-foreground transition-[background-color,border-color] duration-[120ms] ease-out placeholder:text-muted-foreground hover:bg-[var(--row-hover)]/40 focus-visible:outline-none focus-visible:border-primary focus-visible:bg-[var(--surface-focused)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
