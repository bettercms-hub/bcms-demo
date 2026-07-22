/**
 * NewPageDialog — the first-run page creation flow.
 *
 * Two steps:
 * 1. Name, slug, and where it lives (a folder or the root). The URL preview
 *    updates live, inheriting any URL-folder prefix.
 * 2. Start from a blank page or one of your templates.
 *
 * On finish the page is created in the pages store with its folder, then the
 * visual editor opens on it (blank pages open the section library straight
 * away). "New folder" from here opens the folder dialog inline.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, FilePlus2, FolderPlus, LayoutTemplate, Sparkles } from "lucide-react";
import { PAGE_TEMPLATES, instantiateTemplate, type PageTemplate } from "@/components/cms/editor/sections/SectionSystem";
import { newPageId, pagesActions, getPages } from "@/lib/cms/pages-store";
import { folderTrail, folderUrlPrefix, slugifySegment, useFolders } from "@/lib/cms/folders-store";
import { GeneratorShell } from "@/components/cms/generate/GeneratorShell";
import { FolderDialog } from "./FolderDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function NewPageDialog({
  projectId,
  workspace,
  project,
  onClose,
}: {
  projectId: string;
  workspace: string;
  project: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const folders = useFolders(projectId);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState(false);

  const prefix = folderUrlPrefix(folders, folderId);
  const finalSlug = slug.trim() ? slugifySegment(slug) : slugifySegment(name || "page");
  const path = `${prefix}/${finalSlug}`;
  const taken = useMemo(() => getPages(projectId).some((p) => p.path === path), [projectId, path]);
  const valid = name.trim().length >= 1 && !taken;

  function create(template: PageTemplate | null) {
    let unique = path;
    let n = 1;
    while (getPages(projectId).some((p) => p.path === unique)) unique = `${path}-${++n}`;
    pagesActions.add(projectId, {
      id: newPageId(),
      path: unique,
      title: name.trim() || template?.name || "New page",
      state: "draft",
      sections: template ? instantiateTemplate(template) : [],
      updatedAt: Date.now(),
      folderId,
    });
    onClose();
    navigate({
      to: "/w/$workspace/p/$project/visual",
      params: { workspace, project },
      search: { page: unique },
    });
  }

  const footer =
    step === 0 ? (
      <>
        <span className="text-[11.5px] text-muted-foreground">
          {taken ? <span className="text-destructive">That path is already used.</span> : <>URL: <span className="font-mono text-foreground">{path}</span></>}
        </span>
        <Button size="sm" disabled={!valid} onClick={() => setStep(1)}>
          Continue <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </>
    ) : (
      <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
        <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
      </Button>
    );

  return (
    <>
      <GeneratorShell
        icon={FilePlus2}
        title="New page"
        subtitle={step === 0 ? "Name and location" : "Start from"}
        step={step}
        stepCount={2}
        onClose={onClose}
        footer={footer}
      >
        {step === 0 && (
          <div className="space-y-3.5">
            <label className="block">
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Page name</div>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugEdited) setSlug(slugifySegment(e.target.value));
                }}
                autoFocus
                placeholder="Solutions for enterprise"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">URL slug</div>
              <div className="flex items-center rounded-lg border border-[color:var(--color-border)] bg-card px-2.5 focus-within:border-[color:var(--primary)]">
                <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{prefix}/</span>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugEdited(true);
                  }}
                  placeholder="enterprise"
                  className="h-9 w-full bg-transparent px-1 font-mono text-[12.5px] outline-none"
                />
              </div>
            </label>

            <div>
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Folder</div>
              <div className="flex items-center gap-2">
                <select
                  value={folderId ?? ""}
                  onChange={(e) => setFolderId(e.target.value || null)}
                  className="h-9 flex-1 rounded-lg border border-[color:var(--color-border)] bg-card px-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-[color:var(--primary)]"
                >
                  <option value="">No folder (top level)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{folderTrail(folders, f.id)}{f.slug ? "" : "  (organizer)"}</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => setNewFolder(true)}>
                  <FolderPlus className="mr-1 h-3.5 w-3.5" /> New
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">URL folders add to the path, organizers just group the page in this list.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => create(null)}
              className="flex flex-col items-start gap-2 rounded-xl border border-[color:var(--color-border)] bg-card p-3.5 text-left transition-colors hover:border-[color:var(--color-border-strong)] hover:shadow-sm"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:color-mix(in_oklab,var(--primary)_9%,transparent)] text-primary">
                <Sparkles className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[12.5px] font-semibold text-foreground">Blank page</span>
              <span className="text-[10.5px] leading-snug text-muted-foreground">Start empty and add sections</span>
            </button>
            {PAGE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => create(t)}
                className="flex flex-col items-start gap-2 rounded-xl border border-[color:var(--border-hairline)] bg-card p-3.5 text-left transition-colors hover:border-[color:var(--color-border-strong)] hover:shadow-sm"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
                  <t.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="text-[12.5px] font-semibold text-foreground">{t.name}</span>
                <span className="line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">{t.blurb}</span>
              </button>
            ))}
            <div className="col-span-2 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground sm:col-span-3">
              <LayoutTemplate className="h-3.5 w-3.5" /> Picking a template drops you straight into the editor.
            </div>
          </div>
        )}
      </GeneratorShell>

      {newFolder && (
        <FolderDialog
          projectId={projectId}
          folder={null}
          defaultParentId={folderId}
          onClose={() => setNewFolder(false)}
        />
      )}
    </>
  );
}
