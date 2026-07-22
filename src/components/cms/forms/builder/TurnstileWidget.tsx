import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";

/**
 * A faithful stand-in for Cloudflare Turnstile. Static (non-interactive) on the
 * canvas; interactive in the preview where clicking runs a short "verifying"
 * beat and then shows success. No real network calls — this is a prototype.
 */
export function TurnstileWidget({
  interactive = false,
  verified,
  onVerify,
}: {
  interactive?: boolean;
  verified?: boolean;
  onVerify?: (token: string) => void;
}) {
  const [state, setState] = useState<"idle" | "checking">("idle");
  const isDone = !!verified;

  function run() {
    if (!interactive || isDone || state === "checking") return;
    setState("checking");
    window.setTimeout(() => {
      setState("idle");
      onVerify?.(`turnstile_demo_${Date.now().toString(36)}`);
    }, 700);
  }

  return (
    <div
      role={interactive ? "button" : undefined}
      onClick={run}
      className={`flex w-[300px] max-w-full items-center gap-3 rounded-md border border-border bg-[color:var(--card)] px-3 py-2.5 ${
        interactive && !isDone ? "cursor-pointer hover:border-foreground/30" : ""
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border ${
          isDone ? "border-status-success bg-status-success text-white" : "border-border"
        }`}
      >
        {state === "checking" ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : isDone ? (
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        ) : null}
      </span>
      <span className="flex-1 text-[13px] text-foreground">
        {isDone ? "Verified" : state === "checking" ? "Verifying…" : "Verify you are human"}
      </span>
      <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-[#f38020]" />
        Turnstile
      </span>
    </div>
  );
}
