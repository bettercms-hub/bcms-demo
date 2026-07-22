import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type Preset = "7d" | "30d" | "90d" | "12m" | "mtd" | "ytd" | "custom";
export type Compare = "off" | "previous" | "year";

export interface RangeValue {
  preset: Preset;
  start: string; // ISO yyyy-mm-dd
  end: string;
  compare: Compare;
}

const PRESETS: { value: Exclude<Preset, "custom">; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "mtd", label: "Month to date" },
  { value: "ytd", label: "Year to date" },
];

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function daysInRange(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}
export function fmtShort(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function presetRange(preset: Exclude<Preset, "custom">): { start: string; end: string } {
  const today = new Date();
  const end = isoDay(today);
  if (preset === "mtd") return { start: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), end };
  if (preset === "ytd") return { start: isoDay(new Date(today.getFullYear(), 0, 1)), end };
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 365;
  return { start: isoDay(addDays(today, -(days - 1))), end };
}

export function defaultRange(preset: Exclude<Preset, "custom"> = "30d", compare: Compare = "previous"): RangeValue {
  const { start, end } = presetRange(preset);
  return { preset, start, end, compare };
}

export function compareLabel(c: Compare): string {
  return c === "year" ? "vs previous year" : "vs previous period";
}

export function DateRangePicker({ value, onChange }: { value: RangeValue; onChange: (v: RangeValue) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RangeValue>(value);

  function onOpenChange(o: boolean) {
    if (o) setDraft(value);
    setOpen(o);
  }
  function pickPreset(preset: Exclude<Preset, "custom">) {
    const { start, end } = presetRange(preset);
    setDraft((s) => ({ ...s, preset, start, end }));
  }
  function setCustom(patch: Partial<Pick<RangeValue, "start" | "end">>) {
    setDraft((s) => ({ ...s, preset: "custom", ...patch }));
  }
  function apply() {
    onChange(draft);
    setOpen(false);
  }

  const triggerLabel = `${fmtShort(value.start)} – ${fmtShort(value.end)}`;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-border bg-transparent px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[var(--s3)]/50"
        >
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="tabular-nums">{triggerLabel}</span>
          {value.compare !== "off" && (
            <span className="rounded bg-[var(--s3)] px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
              {value.compare === "year" ? "vs year" : "vs prev"}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0">
        <div className="p-3">
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
            Date range
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => pickPreset(p.value)}
                className={`h-8 rounded-md border px-2.5 text-left text-[12px] font-medium transition-colors ${
                  draft.preset === p.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="block text-[10.5px] font-medium text-muted-foreground">From</span>
              <input
                type="date"
                value={draft.start}
                max={draft.end}
                onChange={(e) => setCustom({ start: e.target.value })}
                className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-[12px] text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[10.5px] font-medium text-muted-foreground">To</span>
              <input
                type="date"
                value={draft.end}
                min={draft.start}
                onChange={(e) => setCustom({ end: e.target.value })}
                className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-[12px] text-foreground outline-none focus:border-primary"
              />
            </label>
          </div>
        </div>

        <div className="border-t border-[color:var(--border-hairline)] p-3">
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
            Compare to
          </div>
          <div className="space-y-1">
            {(
              [
                { value: "off", label: "No comparison" },
                { value: "previous", label: "Previous period" },
                { value: "year", label: "Previous year" },
              ] as { value: Compare; label: string }[]
            ).map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setDraft((s) => ({ ...s, compare: c.value }))}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[color:var(--color-row-hover)]"
              >
                <span
                  className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${
                    draft.compare === c.value ? "border-primary" : "border-border"
                  }`}
                >
                  {draft.compare === c.value && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </span>
                <span className={draft.compare === c.value ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] p-3">
          <span className="truncate text-[11px] tabular-nums text-muted-foreground">
            {fmtShort(draft.start)} – {fmtShort(draft.end)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded-md px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              className="h-8 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
