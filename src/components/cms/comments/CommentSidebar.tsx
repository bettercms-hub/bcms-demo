import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox, MessageSquare, Search, Sparkles, ChevronDown, ChevronRight } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { commentsUi, useCommentsUi } from "@/lib/cms/comments-store";
import { threadsQueryOptions } from "@/lib/comments/queries";
import type { CommentSurface, CommentThread } from "@/lib/comments/types";
import { ThreadView } from "./ThreadView";
import { CommentPin } from "./CommentPin";

interface SidebarProps {
  workspaceId: string;
  projectId?: string;
  surface: CommentSurface;
  pageId?: string;
}

const FILTERS = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
] as const;

export function CommentSidebar({ workspaceId, projectId, surface, pageId }: SidebarProps) {
  const open = useCommentsUi((s) => s.sidebarOpen);
  const filter = useCommentsUi((s) => s.filter);
  const search = useCommentsUi((s) => s.search);
  const activeId = useCommentsUi((s) => s.activeThreadId);

  const { data: threads = [] } = useQuery({
    ...threadsQueryOptions({ workspaceId, projectId }),
    enabled: Boolean(workspaceId),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((t) => {
      if (filter === "open" && t.status !== "open") return false;
      if (filter === "resolved" && t.status !== "resolved") return false;
      if (
        q &&
        !t.messages?.some((m) => m.body.toLowerCase().includes(q)) &&
        !t.anchor_ref?.text?.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [threads, filter, search]);

  return (
    <Sheet open={open} onOpenChange={(o) => commentsUi.setSidebarOpen(o)}>
      <SheetContent
        side="right"
        className="flex w-[360px] flex-col gap-0 border-l border-border/60 bg-[color:var(--s1)] p-0 sm:max-w-[360px]"
      >
        <SheetHeader className="border-b border-border/60 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-[13px] font-semibold">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
              Comments
              <span className="rounded bg-[color:var(--s3)] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {filtered.length}
              </span>
            </SheetTitle>
            <button
              type="button"
              onClick={() => commentsUi.toggleMode()}
              className="rounded-md border border-border/60 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground hover:bg-[color:var(--color-row-hover)]"
              title="Click anywhere on the canvas to drop a pin"
            >
              + New
            </button>
          </div>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70" />
            <input
              value={search}
              onChange={(e) => commentsUi.setSearch(e.target.value)}
              placeholder="Search comments…"
              className="h-7 w-full rounded border border-border/60 bg-[color:var(--s4)] pl-7 pr-2 text-[11.5px] outline-none focus:border-[color:var(--ring)]/60"
            />
          </div>
          <div className="-mx-1 mt-2 flex items-center gap-1 px-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => commentsUi.setFilter(f.id)}
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                  filter === f.id
                    ? "border-transparent bg-[color:var(--primary)]/12 text-[color:var(--primary)]"
                    : "border-border/60 text-muted-foreground hover:bg-[color:var(--color-row-hover)]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map((t) => (
                <SidebarThreadRow
                  key={t.id}
                  thread={t}
                  expanded={activeId === t.id}
                  workspaceId={workspaceId}
                  projectId={projectId}
                  surface={surface}
                  pageId={pageId}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SidebarThreadRow({
  thread,
  expanded,
  workspaceId,
  projectId,
  surface,
  pageId,
}: {
  thread: CommentThread;
  expanded: boolean;
  workspaceId: string;
  projectId?: string;
  surface: CommentSurface;
  pageId?: string;
}) {
  const first = thread.messages?.[0];
  const isAi = thread.messages?.some((m) => m.author_kind === "ai");
  const replyCount = Math.max(0, (thread.messages?.length ?? 1) - 1);

  return (
    <li>
      <button
        type="button"
        onClick={() => commentsUi.setActive(expanded ? null : thread.id)}
        className={cn(
          "flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors",
          expanded
            ? "bg-[color:var(--primary)]/[0.06]"
            : "hover:bg-[color:var(--color-row-hover)]",
        )}
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
        <span className="mt-0.5 shrink-0">
          <CommentPin thread={thread} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[11px] font-semibold capitalize">
              {thread.surface}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(thread.last_activity_at).toLocaleDateString()}
            </span>
            {replyCount > 0 && (
              <span className="ml-1 text-[10px] text-muted-foreground">
                · {replyCount} {replyCount === 1 ? "reply" : "replies"}
              </span>
            )}
            {isAi && <Sparkles className="ml-auto h-2.5 w-2.5 text-violet-400" />}
          </div>
          {first && (
            <div className="mt-0.5 line-clamp-2 text-[11.5px] text-foreground/85">
              {first.body}
            </div>
          )}
          {thread.anchor_ref?.text && (
            <div className="mt-1 truncate rounded border-l-2 border-border/70 bg-[color:var(--s3)] px-1.5 py-0.5 text-[10px] italic text-muted-foreground">
              "{thread.anchor_ref.text}"
            </div>
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/40 bg-[color:var(--s2)]">
          <ThreadView
            thread={thread}
            pending={null}
            workspaceId={workspaceId}
            projectId={projectId}
            surface={surface}
            pageId={pageId}
            onClose={() => commentsUi.setActive(null)}
            compact
          />
        </div>
      )}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full place-items-center px-4 text-center text-[11.5px] text-muted-foreground">
      <div className="space-y-2 py-12">
        <Inbox className="mx-auto h-6 w-6 opacity-40" strokeWidth={1.5} />
        <div>No comments yet.</div>
        <div className="text-[10.5px] opacity-80">
          Alt-click anywhere on the canvas, or press the pin icon at the top.
        </div>
      </div>
    </div>
  );
}
