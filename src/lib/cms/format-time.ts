/**
 * Shared relative-time formatter for editor surfaces.
 *
 * Returns short, human-readable deltas: "just now", "12 minutes ago",
 * "in 3 hours", "Mar 4, 2025". Falls back to a locale date string for
 * anything older than ~30 days.
 */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const diff = Date.now() - then;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const minute = 60_000, hour = 3_600_000, day = 86_400_000;
  const fmt = (n: number, unit: string) =>
    `${future ? "in " : ""}${n} ${unit}${n === 1 ? "" : "s"}${future ? "" : " ago"}`;
  if (abs < minute) return future ? "in a moment" : "just now";
  if (abs < hour) return fmt(Math.round(abs / minute), "minute");
  if (abs < day) return fmt(Math.round(abs / hour), "hour");
  if (abs < 30 * day) return fmt(Math.round(abs / day), "day");
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Mon · 14:32" style short stamp for revision rows. */
export function formatRevisionStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.toLocaleDateString(undefined, { weekday: "short" });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day} · ${time}`;
}
