import type { ReactNode } from "react";

interface Props {
  /** Kind label, e.g. "Section", "Page", "Block". Rendered muted. */
  kind?: string;
  /** Primary value, e.g. "Hero". Rendered as foreground text. */
  value?: ReactNode;
  /** Optional leading icon (matches kind). */
  icon?: ReactNode;
  className?: string;
}

const KIND_LABELS: Record<string, string> = {
  page: "Page",
  section: "Section",
  block: "Block",
  collection: "Collection",
  entry: "Entry",
  component: "Component",
  group: "Group",
  settings: "Settings",
};

/**
 * Unified `Section / Hero` style label. Replaces the older
 * `SECTION · Hero` treatment which mixed uppercase, weight, and color.
 * Both halves share typography so the eye can scan the value first
 * and grab orientation from the muted prefix.
 */
export function ContextLabel({ kind, value, icon, className = "" }: Props) {
  const prettyKind = kind ? (KIND_LABELS[kind] ?? capitalize(kind)) : undefined;
  return (
    <div
      className={[
        "flex min-w-0 items-center gap-1.5 text-[12.5px] leading-none",
        className,
      ].join(" ")}
    >
      {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      {prettyKind && (
        <>
          <span className="shrink-0 text-muted-foreground">{prettyKind}</span>
          <span aria-hidden className="shrink-0 text-muted-foreground/50">/</span>
        </>
      )}
      <span className="min-w-0 truncate font-medium text-foreground">
        {value ?? <span className="text-muted-foreground">Nothing selected</span>}
      </span>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
