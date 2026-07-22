import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[72px] w-full rounded-[8px] border border-border bg-card px-3 py-2 text-[13px] text-foreground transition-[background-color,border-color,box-shadow] duration-[120ms] ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-border-strong focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50",
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
