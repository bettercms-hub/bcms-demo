import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Pill, compact, no shadow. Muted fills.
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none transition-colors focus:outline-none focus:ring-1 focus:ring-primary",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-[var(--primary)]",
        secondary:
          "border-border bg-transparent text-foreground-secondary",
        outline:
          "border-border bg-transparent text-foreground-secondary",
        destructive:
          "border-transparent bg-[color-mix(in_srgb,var(--destructive)_18%,transparent)] text-[var(--destructive)]",
        live:
          "border-transparent bg-[color-mix(in_srgb,var(--status-live)_18%,transparent)] text-[var(--status-live)]",
        draft:
          "border-transparent bg-[color-mix(in_srgb,var(--status-draft)_18%,transparent)] text-[var(--status-draft)]",
        preview:
          "border-transparent bg-[color-mix(in_srgb,var(--status-preview)_18%,transparent)] text-[var(--status-preview)]",
        archived:
          "border-transparent bg-[var(--s4)] text-muted-foreground",
        scheduled:
          "border-transparent bg-[color-mix(in_srgb,var(--status-scheduled)_18%,transparent)] text-[var(--status-scheduled)]",
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
