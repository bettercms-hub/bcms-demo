/** Shared avatar math: initials from a name, a stable color from an id. */

export function initialsOf(name: string): string {
  return (
    name
      .split(/[\s.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

const AVATAR_TONES = ["#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#14B8A6", "#F43F5E", "#84CC16"];

export function toneFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}
