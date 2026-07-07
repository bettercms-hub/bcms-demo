import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  collectionActions,
  componentMasterActions,
  entryCreateActions,
  mediaActions,
  pageActions,
} from "@/lib/cms/store";
import { getProjectBySlug } from "@/lib/cms/use-cms";

export type CreateKind =
  | { type: "page"; workspace: string; project: string }
  | { type: "collection"; workspace: string; project: string }
  | { type: "component"; workspace: string; project: string }
  | { type: "entry"; collectionId: string; workspace: string; project: string }
  | { type: "media"; workspace: string; project: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  intent: CreateKind | null;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function CreateEntityModal({ open, onOpenChange, intent }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pageType, setPageType] = useState<"static" | "dynamic" | "template">("static");

  if (!intent) return null;

  const close = () => {
    setName("");
    setSlug("");
    setPageType("static");
    onOpenChange(false);
  };

  const titles: Record<CreateKind["type"], { title: string; desc: string; cta: string }> = {
    page: { title: "New page", desc: "Add a page to this website.", cta: "Create page" },
    collection: {
      title: "New collection",
      desc: "A collection holds entries shaped by a schema.",
      cta: "Create collection",
    },
    component: {
      title: "New component",
      desc: "A reusable element shared across pages.",
      cta: "Create component",
    },
    entry: { title: "New entry", desc: "Add an entry to this collection.", cta: "Create entry" },
    media: { title: "Upload media", desc: "Add an asset to your project library.", cta: "Upload" },
  };
  const meta = titles[intent.type];

  const submit = () => {
    if (intent.type === "page") {
      const pr = getProjectBySlug(intent.workspace, intent.project);
      if (!pr || !name.trim()) return;
      const finalSlug = slug.trim() || `/${slugify(name)}`;
      const id = pageActions.add(pr.id, {
        title: name.trim(),
        slug: finalSlug.startsWith("/") ? finalSlug : `/${finalSlug}`,
        type: pageType,
      });
      navigate({
        to: "/w/$workspace/p/$project/editor",
        params: { workspace: intent.workspace, project: intent.project },
        search: { scope: "pages", node: `page:${id}` },
      });
    } else if (intent.type === "collection") {
      const pr = getProjectBySlug(intent.workspace, intent.project);
      if (!pr || !name.trim()) return;
      const id = collectionActions.add(pr.id, {
        name: name.trim(),
        slug: slug.trim() || slugify(name),
      });
      navigate({
        to: "/w/$workspace/p/$project/editor",
        params: { workspace: intent.workspace, project: intent.project },
        search: { scope: "collections", node: `collection:${id}` },
      });
    } else if (intent.type === "component") {
      const pr = getProjectBySlug(intent.workspace, intent.project);
      if (!pr || !name.trim()) return;
      const id = componentMasterActions.add(pr.id, { name: name.trim() });
      navigate({
        to: "/w/$workspace/p/$project/editor",
        params: { workspace: intent.workspace, project: intent.project },
        search: { scope: "components", node: `component:${id}` },
      });
    } else if (intent.type === "entry") {
      if (!name.trim()) return;
      const id = entryCreateActions.add(intent.collectionId, name.trim());
      navigate({
        to: "/w/$workspace/p/$project/editor",
        params: { workspace: intent.workspace, project: intent.project },
        search: { scope: "collections", node: `entry:${id}` },
      });
    } else if (intent.type === "media") {
      const pr = getProjectBySlug(intent.workspace, intent.project);
      if (!pr || !name.trim()) return;
      mediaActions.add(pr.id, { name: name.trim() });
    }
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-[16px]">{meta.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{meta.desc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {intent.type === "page" && (
            <div className="space-y-2">
              <Label className="text-[12px]">Page type</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["static", "dynamic", "template"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPageType(t)}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      pageType === t
                        ? "border-foreground/40 bg-muted"
                        : "border-border bg-surface hover:border-border-strong"
                    }`}
                  >
                    <div className="text-[13px] font-medium capitalize">{t}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t === "static" && "One-off page"}
                      {t === "dynamic" && "Driven by a collection"}
                      {t === "template" && "Reusable layout"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[12px]">
              {intent.type === "entry" ? "Title" : intent.type === "media" ? "File name" : "Name"}
            </Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
              placeholder={
                intent.type === "page"
                  ? "About"
                  : intent.type === "collection"
                    ? "Blog Posts"
                    : intent.type === "component"
                      ? "Hero"
                      : intent.type === "entry"
                        ? "Untitled entry"
                        : "hero-image.jpg"
              }
            />
          </div>

          {(intent.type === "page" || intent.type === "collection") && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={intent.type === "page" ? "/about" : "posts"}
                className="font-mono"
              />
            </div>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!name.trim()}>
            {meta.cta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
