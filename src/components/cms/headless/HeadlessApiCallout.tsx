import { useState } from "react";
import { Check, Copy, Radio } from "lucide-react";

type KeyType = "Public" | "Preview" | "Server";

const KEY_TONE: Record<KeyType, string> = {
  Public: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Preview: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Server: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const KEY_HINT: Record<KeyType, string> = {
  Public: "Safe to use in frontend browser code.",
  Preview: "Reads drafts. Keep server-side only.",
  Server: "Never expose in the browser.",
};

const API_HOST = "https://api.bettercms.site";

/**
 * The recurring "this lives behind an API" framing for headless projects.
 * Managed sites inject this data into hosted pages; headless projects serve it
 * over the Public/Server API and the customer's own frontend renders it.
 */
export function HeadlessApiCallout({
  method = "GET",
  path,
  description,
  keyType = "Public",
}: {
  method?: "GET" | "POST";
  path: string;
  description: string;
  keyType?: KeyType;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${API_HOST}${path}`;

  return (
    <div className="mb-6 rounded-xl border border-primary/25 bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Radio className="h-3.5 w-3.5 text-primary" />
        <span className="text-[12px] font-semibold text-foreground">Served to your frontend via API</span>
        <span
          title={KEY_HINT[keyType]}
          className={`ml-auto rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${KEY_TONE[keyType]}`}
        >
          {keyType} key
        </span>
      </div>
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {description} <span className="text-foreground/70">{KEY_HINT[keyType]}</span>
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 py-2">
        <span className="rounded bg-[color:var(--s2)] px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-muted-foreground">
          {method}
        </span>
        <span className="flex-1 truncate font-mono text-[12px] text-foreground">{url}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          aria-label="Copy endpoint"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
