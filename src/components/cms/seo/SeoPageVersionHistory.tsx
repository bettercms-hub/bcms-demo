/**
 * Version history panel for per-page SEO edits.
 *
 * Each save appends a snapshot to `seo_page_version`. This component
 * lists those snapshots, lets the user pick one to diff against the
 * current state, and restores it (which itself becomes a new version).
 */
import { useMemo, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useRestoreSeoPageVersion,
  useSeoPageVersions,
  type SeoPageRow,
  type SeoPageSnapshot,
  type SeoPageVersionRow,
} from "@/lib/seo/queries";

interface Props {
  scope: { workspace: string; project: string };
  pageId: string;
  current: SeoPageRow | null;
}

const FIELD_LABELS: Record<keyof SeoPageSnapshot, string> = {
  meta_title: "Title",
  meta_description: "Description",
  slug: "Slug",
  canonical: "Canonical",
  og_title: "OG title",
  og_description: "OG description",
  og_image: "OG image",
  twitter_image: "Twitter image",
  structured_data: "Structured data",
  indexing: "Indexing",
  ai_summary: "AI summary",
  key_takeaways: "Key takeaways",
  faqs: "FAQs",
  entities: "Entities",
  topics: "Topics",
  seo_score: "SEO score",
  aeo_score: "AEO score",
  aeo_breakdown: "AEO breakdown",
};

export function SeoPageVersionHistory({ scope, pageId, current }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: versions = [], isLoading } = useSeoPageVersions(scope, pageId, open);
  const restore = useRestoreSeoPageVersion(scope, pageId);

  const selected = useMemo(
    () => versions.find((v) => v.id === selectedId) ?? versions[0] ?? null,
    [versions, selectedId],
  );

  const handleRestore = async () => {
    if (!selected) return;
    await restore.mutateAsync(selected);
    toast.success(`Restored version ${selected.version_num}`);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-[13px] font-medium hover:bg-[color:var(--color-row-hover)]">
          <History className="h-3.5 w-3.5" />
          History
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-[15px]">SEO version history</SheetTitle>
          <SheetDescription className="text-[12px]">
            Every save is snapshotted. Pick a version to diff against the current state.
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]">
          <aside className="overflow-y-auto border-r border-border">
            {isLoading ? (
              <div className="p-4 text-[12px] text-muted-foreground">Loading…</div>
            ) : versions.length === 0 ? (
              <div className="p-4 text-[12px] text-muted-foreground">
                No versions yet. Save the page to start tracking history.
              </div>
            ) : (
              <ul className="py-1">
                {versions.map((v) => (
                  <li key={v.id}>
                    <button
                      onClick={() => setSelectedId(v.id)}
                      className={`flex w-full flex-col items-start gap-0.5 border-l-2 px-4 py-2.5 text-left transition-colors ${
                        selected?.id === v.id
                          ? "border-l-primary bg-[color:var(--color-row-selected)]"
                          : "border-l-transparent hover:bg-[color:var(--color-row-hover)]"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-[12px] font-semibold">v{v.version_num}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {relativeTime(v.created_at)}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {v.label ?? new Date(v.created_at).toLocaleString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
          <div className="flex min-h-0 flex-col">
            {selected ? (
              <>
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <div className="text-[12px]">
                    <span className="font-semibold">v{selected.version_num}</span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(selected.created_at).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={handleRestore}
                    disabled={restore.isPending}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {restore.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Restore this version
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <DiffView version={selected} current={current} />
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center text-[12px] text-muted-foreground">
                Select a version to view changes.
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DiffView({
  version,
  current,
}: {
  version: SeoPageVersionRow;
  current: SeoPageRow | null;
}) {
  const snap = version.snapshot as Partial<SeoPageSnapshot>;
  const rows = (Object.keys(FIELD_LABELS) as (keyof SeoPageSnapshot)[]).map((key) => {
    const before = stringify(snap[key]);
    const after = stringify(current?.[key] as unknown);
    return { key, before, after, changed: before !== after };
  });
  const changedCount = rows.filter((r) => r.changed).length;

  return (
    <div className="px-5 py-4">
      <div className="mb-3 text-[11px] text-muted-foreground">
        {changedCount === 0
          ? "No differences from current state."
          : `${changedCount} field${changedCount === 1 ? "" : "s"} differ from current state.`}
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <details
            key={r.key}
            open={r.changed}
            className={`rounded-md border ${r.changed ? "border-amber-500/30 bg-amber-500/[0.03]" : "border-border bg-background"}`}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[12px]">
              <span className="font-medium">{FIELD_LABELS[r.key]}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  r.changed
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {r.changed ? "Changed" : "Same"}
              </span>
            </summary>
            <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
              <FieldPane label="This version" value={r.before} tone={r.changed ? "before" : "neutral"} />
              <FieldPane label="Current" value={r.after} tone={r.changed ? "after" : "neutral"} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function FieldPane({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "before" | "after" | "neutral";
}) {
  const bg =
    tone === "before"
      ? "bg-red-500/[0.06]"
      : tone === "after"
        ? "bg-emerald-500/[0.06]"
        : "bg-background";
  return (
    <div className={`flex min-h-[44px] flex-col gap-1 p-3 ${bg}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground">
        {value || <span className="text-muted-foreground">—</span>}
      </pre>
    </div>
  );
}

function stringify(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
