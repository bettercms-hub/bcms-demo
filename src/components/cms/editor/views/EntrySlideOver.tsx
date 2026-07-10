/**
 * EntrySlideOver — slide-over editor for a single entry.
 *
 * Reuses the existing <EntryView> form for the Content tab so we don't
 * re-implement field rendering. Other tabs are placeholders that
 * surface the existing publish-state controls and metadata.
 */
import { useState } from "react";
import { GitCompareArrows } from "lucide-react";
import { useParams } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCMS } from "@/lib/cms/store";
import { diffEntry } from "@/lib/cms/snapshots";
import { canEditContent, useEffectiveRole } from "@/lib/workspace/my-role";
import { PublishBadge } from "@/components/cms/ui/StatusBadge";
import { WorkflowStageBadge } from "@/components/cms/workflow/WorkflowBits";
import { EntryView } from "./EntryView";
import { CompareVersionsDialog } from "./CompareVersionsDialog";
import { EntrySeoPanel } from "./entry-tabs/EntrySeoPanel";
import { EntryPublishingPanel } from "./entry-tabs/EntryPublishingPanel";
import { EntryHistoryPanel } from "./entry-tabs/EntryHistoryPanel";
import { EntryCommentsPanel } from "./entry-tabs/EntryCommentsPanel";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entryId: string | null;
}

export function EntrySlideOver({ open, onOpenChange, entryId }: Props) {
  const entry = useCMS((s) => (entryId ? s.entries.find((e) => e.id === entryId) : undefined));
  const { workspace } = useParams({ strict: false }) as { workspace?: string };
  const { effective } = useEffectiveRole(workspace ?? "");
  const canEdit = canEditContent(effective);
  const [compareOpen, setCompareOpen] = useState(false);

  const changed = entry?.publishedSnapshot
    ? diffEntry(entry, entry.publishedSnapshot).changedFields.size +
      (entry.publishedSnapshot.entry.title !== entry.title ? 1 : 0)
    : 0;

  return (
    <Sheet open={open && !!entryId} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(760px,94vw)] sm:max-w-[760px] !p-0 border-l border-border/40 bg-[color:var(--canvas)] flex flex-col"
      >
        {entry ? (
          <Tabs defaultValue="content" className="flex h-full min-h-0 flex-col">
            <SheetTitle className="sr-only">{entry.title || "Entry"}</SheetTitle>
            <div className="flex items-center gap-3 border-b border-border/40 px-5 pt-4 pb-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold tracking-tight">
                  {entry.title || "Untitled"}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  {entry.status && <PublishBadge state={entry.status} />}
                  <WorkflowStageBadge entry={entry} />
                  <span>Updated {new Date(entry.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              {entry.publishedSnapshot && (
                <button
                  type="button"
                  onClick={() => setCompareOpen(true)}
                  title="Compare the draft with the published version"
                  className="relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
                >
                  <GitCompareArrows className="h-3.5 w-3.5" /> Compare
                  {changed > 0 && (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500/20 px-1 text-[10px] font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                      {changed}
                    </span>
                  )}
                </button>
              )}
            </div>
            <TabsList className="mx-5 mt-2 w-auto justify-start gap-1 bg-transparent p-0">
              <SlideTab value="content">Content</SlideTab>
              <SlideTab value="seo">SEO</SlideTab>
              <SlideTab value="publishing">Publishing</SlideTab>
              <SlideTab value="history">History</SlideTab>
              <SlideTab value="comments">Comments</SlideTab>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TabsContent value="content" className="m-0">
                <EntryView entryId={entry.id} />
              </TabsContent>
              <TabsContent value="seo" className="m-0">
                <EntrySeoPanel entry={entry} />
              </TabsContent>
              <TabsContent value="publishing" className="m-0">
                <EntryPublishingPanel entry={entry} onCompare={() => setCompareOpen(true)} />
              </TabsContent>
              <TabsContent value="history" className="m-0">
                <EntryHistoryPanel entryId={entry.id} />
              </TabsContent>
              <TabsContent value="comments" className="m-0">
                <EntryCommentsPanel entryId={entry.id} />
              </TabsContent>
            </div>
            {compareOpen && (
              <CompareVersionsDialog entryId={entry.id} canEdit={canEdit} onClose={() => setCompareOpen(false)} />
            )}
          </Tabs>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SlideTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="h-7 rounded-md border border-transparent px-2.5 text-[12px] text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-[color:var(--card)] data-[state=active]:text-foreground data-[state=active]:shadow-none"
    >
      {children}
    </TabsTrigger>
  );
}
