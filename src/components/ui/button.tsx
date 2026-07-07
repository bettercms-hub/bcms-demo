import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium cursor-pointer transition-[background-color,border-color,box-shadow,color] duration-[120ms] ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary: sacred pink. One per surface.
        default:
          "bg-primary text-primary-foreground hover:bg-[var(--primary-hover)] active:bg-[var(--primary-pressed)]",
        // Secondary: transparent + hairline border
        secondary:
          "bg-transparent text-foreground border border-border hover:bg-[var(--row-hover)] hover:border-border-strong",
        outline:
          "bg-transparent text-foreground border border-border hover:bg-[var(--row-hover)] hover:border-border-strong",
        // Ghost: transparent, hover only
        ghost: "bg-transparent text-foreground hover:bg-[var(--row-hover)]",
        link: "text-primary underline-offset-4 hover:underline",
        // Danger: muted red
        destructive:
          "bg-transparent text-[var(--destructive)] border border-[color-mix(in_srgb,var(--destructive)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)]",
        danger:
          "bg-transparent text-[var(--destructive)] border border-[color-mix(in_srgb,var(--destructive)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)]",
        success:
          "bg-[var(--status-success)] text-black hover:opacity-90",
      },
      size: {
        // Per spec: primary CTA ~40h, secondary actions 32, dense 28
        default: "h-10 px-4",
        sm: "h-8 px-3 text-[12px]",
        xs: "h-7 px-2.5 text-[12px]",
        lg: "h-11 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
