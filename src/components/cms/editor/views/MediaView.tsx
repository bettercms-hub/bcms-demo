import { ImageIcon, FileVideo, File } from "lucide-react";
import { getMedia } from "@/lib/cms/use-cms";

export function MediaView({ mediaId }: { mediaId: string }) {
  const m = getMedia(mediaId);
  if (!m) return null;
  const Icon = m.kind === "image" ? ImageIcon : m.kind === "video" ? FileVideo : File;
  return (
    <div className="mx-auto max-w-xl px-6 py-6">
      <div className="mb-5 border-b border-border pb-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Media</div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{m.name}</h1>
      </div>
      <div className="grid aspect-video place-items-center rounded-md border border-border bg-background text-muted-foreground">
        <Icon className="h-10 w-10" strokeWidth={1} />
      </div>
      <div className="mt-4 grid grid-cols-[100px_1fr] gap-y-2 font-mono text-xs">
        <div className="text-muted-foreground">kind</div><div>{m.kind}</div>
        <div className="text-muted-foreground">size</div><div>{m.size ?? "—"}</div>
        <div className="text-muted-foreground">id</div><div>{m.id}</div>
      </div>
    </div>
  );
}
