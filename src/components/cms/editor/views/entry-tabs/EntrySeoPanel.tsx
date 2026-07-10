/**
 * SEO panel for an entry. Writes via entryActions.update so the slide-over
 * stays in sync with the rest of the editor.
 */
import { entryActions, useCMS } from "@/lib/cms/store";
import type { Entry } from "@/lib/cms/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EntrySeoPanel({ entry }: { entry: Entry }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const media = useCMS((s) => s.media.filter((m) => m.kind === "image"));
  const collection = useCMS((s) =>
    s.collections.find((c) => c.id === entry.collectionId),
  );

  // Derive sensible current values from the entry itself so SEO inputs
  // are pre-populated instead of looking blank for fresh entries.
  const fields = (entry.fields ?? {}) as Record<string, unknown>;
  const pickString = (...keys: string[]): string => {
    for (const k of keys) {
      const v = fields[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };
  const resolveMediaUrl = (val: string): string => {
    if (!val) return "";
    if (val.startsWith("md_")) {
      const m = media.find((mm) => mm.id === val);
      return m?.url ?? "";
    }
    return val;
  };

  const derivedSlug = pickString("slug");
  const derivedDescription = pickString(
    "excerpt",
    "summary",
    "description",
    "seoDescription",
    "metaDescription",
  );
  const derivedImage = resolveMediaUrl(
    pickString("cover", "coverImage", "ogImage", "image", "thumbnail"),
  );
  const derivedCanonical =
    collection && derivedSlug
      ? `https://your-site.com/${collection.slug}/${derivedSlug}`
      : "";

  const title = entry.metaTitle ?? entry.title ?? "";
  const description = entry.metaDescription ?? derivedDescription;
  const canonical = entry.canonical ?? derivedCanonical;
  const ogImage = entry.ogImage ?? derivedImage;
  const indexing = entry.indexing ?? "index";

  const previewUrl = useMemo(
    () => canonical || `https://your-site.com/${entry.id}`,
    [canonical, entry.id],
  );

  return (
    <div className="space-y-5 p-6">
      {/* Search preview */}
      <div className="rounded-lg border border-border/60 bg-[color:var(--card)] p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Search preview
        </div>
        <div className="mt-2 truncate text-[13px] text-emerald-700">{previewUrl}</div>
        <div className="mt-0.5 truncate text-[16px] text-blue-700">
          {title || "Untitled"}
        </div>
        <div className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
          {description || "No meta description set."}
        </div>
      </div>

      <Field
        label="Meta title"
        hint={`${title.length}/60`}
        warn={title.length > 60}
      >
        <Input
          value={title}
          onChange={(e) => entryActions.update(entry.id, { metaTitle: e.target.value })}
          placeholder="Page title for search results"
        />
      </Field>

      <Field
        label="Meta description"
        hint={`${description.length}/160`}
        warn={description.length > 160}
      >
        <Textarea
          rows={3}
          value={description}
          onChange={(e) =>
            entryActions.update(entry.id, { metaDescription: e.target.value })
          }
          placeholder="Short summary shown under the title in search results"
        />
      </Field>

      <Field label="Canonical URL">
        <Input
          value={canonical}
          onChange={(e) => entryActions.update(entry.id, { canonical: e.target.value })}
          placeholder="https://your-site.com/posts/my-post"
        />
      </Field>

      <Field label="Open Graph image">
        <div className="flex gap-2">
          <Input
            value={ogImage}
            onChange={(e) => entryActions.update(entry.id, { ogImage: e.target.value })}
            placeholder="https://… or pick from media"
          />
          <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
            Pick
          </Button>
        </div>
        {ogImage ? (
          <div className="mt-2 overflow-hidden rounded-md border border-border/60">
            <img src={ogImage} alt="OG preview" className="h-32 w-full object-cover" />
          </div>
        ) : null}
      </Field>

      <Field label="Indexing">
        <div className="flex gap-2">
          {(["index", "noindex"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => entryActions.update(entry.id, { indexing: v })}
              className={`h-8 rounded-md border px-3 text-[12px] ${
                indexing === v
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground"
              }`}
            >
              {v === "index" ? "Allow indexing" : "Hide from search"}
            </button>
          ))}
        </div>
      </Field>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pick an image</DialogTitle>
          </DialogHeader>
          {media.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              No images uploaded yet.
            </div>
          ) : (
            <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto">
              {media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    entryActions.update(entry.id, { ogImage: m.url });
                    setPickerOpen(false);
                  }}
                  className="overflow-hidden rounded-md border border-border/60 hover:border-foreground"
                >
                  <img src={m.thumbUrl || m.url} alt={m.name} className="h-24 w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  hint,
  warn,
  children,
}: {
  label: string;
  hint?: string;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[12px] font-medium">{label}</Label>
        {hint ? (
          <span className={`text-[11px] ${warn ? "text-amber-600" : "text-muted-foreground"}`}>
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
