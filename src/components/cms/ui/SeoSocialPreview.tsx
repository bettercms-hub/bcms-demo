import { ImageIcon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  url: string;
  image?: string;
}

/** OG-style social card preview. */
export function SeoSocialPreview({ title, description, url, image }: Props) {
  const domain = url.replace(/^https?:\/\//, "").split("/")[0];
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Social preview</div>
      <div className="mt-3 overflow-hidden rounded-md border border-border">
        <div className="grid aspect-[1200/630] place-items-center bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
              <div className="text-[11px]">1200 × 630 og:image</div>
            </div>
          )}
        </div>
        <div className="border-t border-border bg-surface p-3">
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{domain}</div>
          <div className="mt-1 line-clamp-2 text-[13px] font-medium text-foreground">{title || "Untitled"}</div>
          {description && (
            <div className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{description}</div>
          )}
        </div>
      </div>
    </div>
  );
}
