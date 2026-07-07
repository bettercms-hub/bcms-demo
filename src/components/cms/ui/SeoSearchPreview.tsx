interface Props {
  title: string;
  description: string;
  url: string;
}

/** Google SERP-style result preview. */
export function SeoSearchPreview({ title, description, url }: Props) {
  const display = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const t = title.length > 60 ? title.slice(0, 57).trimEnd() + "…" : title;
  const d = description.length > 160 ? description.slice(0, 157).trimEnd() + "…" : description;

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Search preview</div>
      <div className="mt-3">
        <div className="text-[12.5px] leading-tight text-emerald-700 dark:text-emerald-400">
          {display}
        </div>
        <div className="mt-0.5 text-[18px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
          {t || "Untitled"}
        </div>
        <div className="mt-1 text-[13px] leading-snug text-muted-foreground">
          {d || "Add a meta description to control how this page appears in search."}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>{title.length} / 60 title</span>
        <span>·</span>
        <span>{description.length} / 160 description</span>
      </div>
    </div>
  );
}
