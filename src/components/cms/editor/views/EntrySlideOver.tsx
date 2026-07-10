/**
 * EntrySlideOver — slide-over editor for a single entry.
 *
 * Reuses the existing <EntryView> form for the Content tab. Status and
 * publishing live in the persistent EntryWorkflowBar footer (one source),
 * so the header stays a clean title + updated stamp. Nested dialogs the
 * footer opens (Compare, Schedule, Request changes) are portalled to the
 * body, so the sheet is told to ignore interactions inside them — otherwise
 * clicking those dialogs would read as an outside click and close the sheet.
 */
import { useParams } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCMS } from "@/lib/cms/store";
import { useProjectPresence } from "@/lib/workspace/presence-store";
import { PresenceStack } from "@/components/cms/presence/Presence";
import { EntryWorkflowBar } from "@/components/cms/editor/EntryWorkflowBar";
import { EntryView } from "./EntryView";
import { EntrySeoPanel } from "./entry-tabs/EntrySeoPanel";
import { EntryPublishingPanel } from "./entry-tabs/EntryPublishingPanel";
import { EntryHistoryPanel } from "./entry-tabs/EntryHistoryPanel";
import { EntryCommentsPanel } from "./entry-tabs/EntryCommentsPanel";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entryId: string | null;
}

/** True when an event originated inside a hand-rolled nested dialog. */
function inNestedDialog(target: EventTarget | null): boolean {
  return !!(target as Element | null)?.closest?.("[data-nested-dialog]");
}

export function EntrySlideOver({ open, onOpenChange, entryId }: Props) {
  const entry = useCMS((s) => (entryId ? s.entries.find((e) => e.id === entryId) : undefined));
  const { workspace } = useParams({ strict: false }) as { workspace?: string };

  const projectId = useCMS((s) => (entry ? s.collections.find((c) => c.id === entry.collectionId)?.projectId : undefined));
  const peers = useProjectPresence(projectId);
  const here = entry ? peers.filter((p) => p.entryId === entry.id && p.status === "active") : [];

  return (
    <Sheet open={open && !!entryId} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(760px,94vw)] sm:max-w-[760px] !p-0 border-l border-border/40 bg-[color:var(--canvas)] flex flex-col"
        onInteractOutside={(e) => {
          if (inNestedDialog((e as CustomEvent).detail?.originalEvent?.target ?? e.target)) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (typeof document !== "undefined" && document.querySelector("[data-nested-dialog]")) e.preventDefault();
        }}
      >
        {entry ? (
          <Tabs defaultValue="content" className="flex h-full min-h-0 flex-col">
            <SheetTitle className="sr-only">{entry.title || "Entry"}</SheetTitle>
            <div className="flex items-center gap-3 border-b border-border/40 px-5 pt-4 pb-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold tracking-tight">
                  {entry.title || "Untitled"}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Updated {new Date(entry.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <PresenceStack peers={here} size={24} max={3} />
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
                <EntryPublishingPanel entry={entry} />
              </TabsContent>
              <TabsContent value="history" className="m-0">
                <EntryHistoryPanel entryId={entry.id} />
              </TabsContent>
              <TabsContent value="comments" className="m-0">
                <EntryCommentsPanel entryId={entry.id} />
              </TabsContent>
            </div>
            <EntryWorkflowBar entryId={entry.id} wsSlug={workspace ?? ""} />
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
