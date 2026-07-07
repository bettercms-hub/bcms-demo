import { cn } from "@/lib/utils";

/**
 * The BetterCMS brand logo (icon + wordmark). Single source of truth so the
 * brand renders identically everywhere — top bar, editor breadcrumb, auth.
 *
 * The asset lives at /public/logo.png. Its wordmark is dark, so on the dark
 * theme we render it as a clean white silhouette (`dark:brightness-0 invert`).
 * Control size with a height utility via `className` (defaults to h-5).
 */
export function Logo({ className, alt = "BetterCMS" }: { className?: string; alt?: string }) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      draggable={false}
      className={cn("h-5 w-auto select-none dark:brightness-0 dark:invert", className)}
    />
  );
}
