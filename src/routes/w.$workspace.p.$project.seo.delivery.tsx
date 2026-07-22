/**
 * SEO > AI delivery — llms.txt (auto-generated or a hand-authored override),
 * llms-full.txt, and the content-negotiation note. Moved here from the
 * Markdown manager so it lives alongside the other machine-consumption
 * surfaces (sitemap, RSS, robots).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Check, Copy, FileCode2, FileText, Pencil, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { collections as allCollections, entries as allEntries, schemas as allSchemas } from "@/lib/cms/mock-data";
import { usePages } from "@/lib/cms/pages-store";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { mdActions, useMdState } from "@/lib/md/md-store";
import { llmsFullTxt, llmsTxt, type LlmsInput } from "@/lib/md/serialize";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DialogShell, MdPreviewDialog } from "@/components/cms/markdown/MarkdownManager";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/w/$workspace/p/$project/seo/delivery")({
  component: DeliveryPage,
});

function DeliveryPage() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  const staging = `${pr.slug}.bettercms.site`;
  const domain = pr.domain ?? staging;
  const site = { name: pr.name, domain };

  const pages = usePages(pr.id);
  const md = useMdState(pr.id);
  const [preview, setPreview] = useState<{ title: string; path: string; body: string } | null>(null);
  const [llmsEdit, setLlmsEdit] = useState<string | null>(null);
  const llmsUploadRef = useRef<HTMLInputElement>(null);

  const cols = useMemo(
    () =>
      allCollections
        .filter((c) => c.projectId === pr.id)
        .map((collection) => ({
          collection,
          schema: allSchemas.find((s) => s.id === collection.schemaId),
          entries: allEntries.filter((e) => e.collectionId === collection.id),
        })),
    [pr.id],
  );

  const publishedFiles = md.files.filter((f) => f.state === "published");
  const llmsInput: LlmsInput = {
    site,
    pages: pages.filter((p) => !md.excluded.includes(p.path)),
    collections: cols.map((g) => ({ ...g, entries: g.entries.filter((e) => !md.excluded.includes(e.id)) })),
    files: publishedFiles.map((f) => ({ path: f.path, title: f.title })),
  };
  const generatedLlms = llmsTxt(llmsInput);
  const activeLlms = md.llmsMode === "custom" ? md.llmsCustom : generatedLlms;

  function copyUrl(path: string) {
    navigator.clipboard.writeText(`https://${domain}${path}`);
    toast.success("URL copied");
  }

  function onLlmsUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      mdActions.setLlmsMode(pr.id, "custom", String(reader.result ?? ""));
      toast.success("llms.txt replaced with your file");
    };
    reader.readAsText(file);
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="text-[20px] font-semibold tracking-tight">AI delivery</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Everything on this site, served as markdown for agents and answer engines.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
        {/* llms.txt: auto or a hand-authored override */}
        <div className="flex items-start gap-3 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12.5px] font-semibold text-foreground">llms.txt</span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  md.llmsMode === "custom"
                    ? "bg-[color:color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary"
                    : "bg-[color:var(--s2)] text-muted-foreground",
                )}
              >
                {md.llmsMode === "custom" ? "Custom" : "Auto"}
              </span>
              {md.llms && (
                <button type="button" onClick={() => copyUrl("/llms.txt")} className="inline-flex items-center gap-1 rounded-md bg-[color:var(--s2)] px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground transition-colors hover:text-foreground" title="Copy URL">
                  {domain}/llms.txt <Copy className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {md.llmsMode === "custom"
                ? "Serving your uploaded file. Revert to keep it generated from the site automatically."
                : "A markdown index of everything worth reading, generated from the site. Agents and AI dev tools fetch this first."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => setPreview({ title: "llms.txt", path: "/llms.txt", body: activeLlms })}>
              Preview
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => setLlmsEdit(activeLlms)}>
              <Pencil className="mr-1 h-3 w-3" /> Edit
            </Button>
            <input ref={llmsUploadRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(e) => e.target.files?.[0] && onLlmsUpload(e.target.files[0])} />
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => llmsUploadRef.current?.click()}>
              <Upload className="mr-1 h-3 w-3" /> Upload
            </Button>
            {md.llmsMode === "custom" && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px] text-muted-foreground" onClick={() => { mdActions.setLlmsMode(pr.id, "auto"); toast.success("Back to auto-generated"); }} title="Revert to auto">
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
            <Switch checked={md.llms} onCheckedChange={(v) => mdActions.setSurface(pr.id, "llms", v)} aria-label="Serve llms.txt" />
          </div>
        </div>

        {/* llms-full.txt */}
        <div className="flex items-start gap-3 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12.5px] font-semibold text-foreground">llms-full.txt</span>
              {md.llmsFull && (
                <button type="button" onClick={() => copyUrl("/llms-full.txt")} className="inline-flex items-center gap-1 rounded-md bg-[color:var(--s2)] px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground transition-colors hover:text-foreground" title="Copy URL">
                  {domain}/llms-full.txt <Copy className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              The whole site inlined in one file. Large sites can exceed agent context windows, so this stays off unless you need it.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => setPreview({ title: "llms-full.txt", path: "/llms-full.txt", body: llmsFullTxt(llmsInput, publishedFiles) })}>
              Preview
            </Button>
            <Switch checked={md.llmsFull} onCheckedChange={(v) => mdActions.setSurface(pr.id, "llmsFull", v)} aria-label="Serve llms-full.txt" />
          </div>
        </div>

        {/* Content negotiation */}
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
            <FileCode2 className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-foreground">Content negotiation</div>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Every canonical URL also answers markdown requests directly, so agents never need a second URL. Search engines
              see one page, agents get clean markdown.
            </p>
            <code className="mt-1.5 block w-fit rounded-md bg-[color:var(--s2)] px-2 py-1 font-mono text-[11px] text-foreground">
              curl -H "Accept: text/markdown" https://{domain}/pricing
            </code>
          </div>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-status-success">
            <Check className="h-3 w-3" /> Always on
          </span>
        </div>
      </div>

      {preview && <MdPreviewDialog {...preview} onClose={() => setPreview(null)} />}
      {llmsEdit !== null && (
        <LlmsEditDialog
          initial={llmsEdit}
          isCustom={md.llmsMode === "custom"}
          onClose={() => setLlmsEdit(null)}
          onSave={(body) => {
            mdActions.setLlmsMode(pr.id, "custom", body);
            toast.success("llms.txt saved");
            setLlmsEdit(null);
          }}
          onRevert={() => {
            mdActions.setLlmsMode(pr.id, "auto");
            toast.success("Back to auto-generated");
            setLlmsEdit(null);
          }}
        />
      )}
    </>
  );
}

function LlmsEditDialog({ initial, isCustom, onClose, onSave, onRevert }: { initial: string; isCustom: boolean; onClose: () => void; onSave: (body: string) => void; onRevert: () => void }) {
  const [body, setBody] = useState(initial);
  return (
    <DialogShell
      title="Edit llms.txt"
      subtitle="/llms.txt"
      icon={FileText}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
          {isCustom ? (
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onRevert}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Revert to auto
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Saving switches llms.txt from auto to your custom version.</span>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => onSave(body)}>Save llms.txt</Button>
          </div>
        </div>
      }
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-[46vh] w-full flex-1 resize-none border-0 bg-[color:var(--s2)] p-4 font-mono text-[12.5px] leading-relaxed text-foreground outline-none"
        spellCheck={false}
      />
    </DialogShell>
  );
}
