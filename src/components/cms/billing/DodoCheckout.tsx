import { useState } from "react";
import { Check, CreditCard, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtUSD } from "@/lib/billing/pricing";

/**
 * Dodo Payments style checkout, test mode. Presented, never processed.
 * Every number the customer would be charged is visible before they commit.
 */

export interface CheckoutLine {
  label: string;
  detail?: string;
  amount: number;
}

export function DodoCheckoutDialog({
  open,
  onOpenChange,
  title,
  lines,
  cycle = "yearly",
  onComplete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  lines: CheckoutLine[];
  cycle?: "monthly" | "yearly";
  onComplete: () => void;
}) {
  const [step, setStep] = useState<"review" | "done">("review");
  const monthly = lines.reduce((s, l) => s + l.amount, 0);
  const chargedNow = cycle === "yearly" ? monthly * 12 : monthly;

  function close(o: boolean) {
    onOpenChange(o);
    if (!o) setStep("review");
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>{title}</DialogTitle>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-600 dark:text-amber-400">
              Dodo Payments · Test mode
            </span>
          </div>
          <DialogDescription>
            This is a demo checkout. No real payment runs and no card is charged.
          </DialogDescription>
        </DialogHeader>

        {step === "review" ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-[color:var(--border-hairline)]">
              {lines.map((l, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${i > 0 ? "border-t border-[color:var(--border-hairline)]" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-foreground">{l.label}</div>
                    {l.detail && <div className="text-[11.5px] text-muted-foreground">{l.detail}</div>}
                  </div>
                  <div className="shrink-0 text-[13px] tabular-nums text-foreground">{fmtUSD(l.amount)}/mo</div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-[color:var(--color-border)] bg-[color:var(--s2)] px-3.5 py-2.5">
                <div className="text-[13px] font-semibold text-foreground">
                  Due today{cycle === "yearly" ? ", billed yearly" : ""}
                </div>
                <div className="text-[14px] font-semibold tabular-nums text-foreground">{fmtUSD(chargedNow)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s1)] px-3 py-2.5">
              <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-mono text-[12.5px] text-foreground">4242 4242 4242 4242</span>
              <span className="ml-auto text-[11px] text-muted-foreground">Test card</span>
            </div>

            <button
              type="button"
              onClick={() => setStep("done")}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
            >
              <Lock className="h-3.5 w-3.5" /> Pay {fmtUSD(chargedNow)} (test)
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              You can change or cancel any time. Downgrades are as easy as upgrades.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/12">
              <Check className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-foreground">All set</div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Your plan is updated. The new total shows on the billing page right away.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onComplete();
                close(false);
              }}
              className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] text-[13px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              Done
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
