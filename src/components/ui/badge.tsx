import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // V2: square soft-fill chips. No shadow.
  "inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[12.5px] font-medium leading-none transition-colors focus:outline-none focus:ring-1 focus:ring-primary",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-[var(--primary)]",
        secondary:
          "border-border bg-transparent text-[var(--foreground-secondary)]",
        outline:
          "border-border bg-transparent text-[var(--foreground-secondary)]",
        destructive:
          "border-transparent bg-[color-mix(in_srgb,var(--destructive)_14%,transparent)] text-[var(--destructive)]",
        live:
          "border-transparent bg-[var(--status-live-bg)] text-[var(--status-live-fg)]",
        draft:
          "border-transparent bg-[var(--status-draft-bg)] text-[var(--status-draft-fg)]",
        preview:
          "border-transparent bg-[var(--status-review-bg)] text-[var(--status-review-fg)]",
        archived:
          "border-transparent bg-[var(--s4)] text-muted-foreground",
        scheduled:
          "border-transparent bg-[color-mix(in_srgb,var(--status-scheduled)_14%,transparent)] text-[var(--status-scheduled)]",
        // Plan chips: the one pill exception — outlined, plan-blue
        plan:
          "rounded-full border-[var(--plan-border)] bg-transparent px-2.5 font-semibold text-[var(--plan-fg)]",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
