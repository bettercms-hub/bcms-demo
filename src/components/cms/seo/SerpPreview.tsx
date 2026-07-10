interface Props {
  title: string;
  description: string;
  url: string;
  engine?: "google" | "bing";
}

export function SerpPreview({ title, description, url, engine = "google" }: Props) {
  const display = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const isGoogle = engine === "google";
  return (
    <div className="rounded-lg border border-border bg-background p-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {isGoogle ? "Google search result" : "Bing search result"}
      </div>
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <div className="grid h-5 w-5 place-items-center rounded-full bg-muted text-[10px] font-semibold">
          {display[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="truncate">{display}</span>
      </div>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className={`mt-1 block text-[18px] leading-snug ${
          isGoogle ? "text-[#1a0dab] dark:text-[#8ab4f8]" : "text-[#1a0dab] dark:text-[#a6c8ff]"
        } hover:underline`}
      >
        {title || "Untitled page"}
      </a>
      <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
        {description || "No description set. Google will generate one from page content."}
      </p>
    </div>
  );
}
