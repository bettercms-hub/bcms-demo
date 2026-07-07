import { Link } from "@tanstack/react-router";
import { Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_PLANS, firstPlanWith } from "@/lib/billing/pricing";

/**
 * Calm locked state for plan gated features. Always says exactly what the
 * feature is and which plan includes it. No fear, no countdowns, one button.
 */
export function LockedFeature({
  featureKey,
  title,
  blurb,
  wsSlug,
}: {
  featureKey: string;
  title: string;
  blurb: string;
  wsSlug: string;
}) {
  const plan = firstPlanWith(featureKey);
  const planName = plan ? SITE_PLANS[plan].name : "a higher plan";

  return (
    <div className="flex w-full flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--card)] px-8 py-10 text-center">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[color:var(--s2)]">
          <Lock className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <h2 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Available on {planName}. {blurb}
        </p>
        <Button asChild size="sm" className="mt-5">
          <Link to="/w/$workspace/settings/plans" params={{ workspace: wsSlug }}>
            See plans
          </Link>
        </Button>
        <p className="mt-4 text-[12px] text-muted-foreground/80">
          Everything else keeps working. Upgrade only if you need this.
        </p>
      </div>
    </div>
  );
}

/** Tiny muted chip for contextual plan notes next to page content. */
export function InlinePlanHint({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-2 py-1 text-[11.5px] leading-none text-muted-foreground">
      <Info className="h-3 w-3 shrink-0" strokeWidth={1.75} />
      {text}
    </span>
  );
}
