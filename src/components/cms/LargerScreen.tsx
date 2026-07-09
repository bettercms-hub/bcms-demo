/**
 * LargerScreen — friendly interstitial for surfaces that stay desktop
 * (or tablet) only. Mobile gets a focused editor product, not a broken
 * squeeze of the schema builder, so gated routes render this instead.
 */
import { Link } from "@tanstack/react-router";
import { ArrowLeft, MonitorSmartphone } from "lucide-react";
import { useViewportTier, type ViewportTier } from "@/lib/device";

export function LargerScreen({
  feature,
  minTier = "tablet",
  workspace,
  project,
}: {
  /** Human name of the surface, e.g. "The schema builder". */
  feature: string;
  /** Smallest tier the surface works on. */
  minTier?: Exclude<ViewportTier, "mobile">;
  workspace: string;
  project?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-[380px] text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--s2)] text-muted-foreground">
          <MonitorSmartphone className="h-7 w-7" aria-hidden />
        </span>
        <h2 className="mt-4 text-[16px] font-semibold text-foreground">Built for a bigger screen</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {feature} needs more room than this screen gives it. It works on{" "}
          {minTier === "tablet" ? "tablets and desktops" : "desktops"}. Pages, content and settings all work right here.
        </p>
        {project ? (
          <Link
            to="/w/$workspace/p/$project/content"
            params={{ workspace, project }}
            className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Go to pages
          </Link>
        ) : (
          <Link
            to="/w/$workspace"
            params={{ workspace }}
            className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to projects
          </Link>
        )}
      </div>
    </div>
  );
}

/** True when the current tier is below the required one. */
export function useNeedsLargerScreen(minTier: Exclude<ViewportTier, "mobile">): boolean {
  const tier = useViewportTier();
  if (tier === "desktop") return false;
  if (tier === "tablet") return minTier === "desktop" ? true : false;
  return true; // mobile: anything gated needs more room
}
