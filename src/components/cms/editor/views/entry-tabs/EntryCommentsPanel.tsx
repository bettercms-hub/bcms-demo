/**
 * Comments panel: lightweight per-entry discussion stored in the CMS store.
 */
import { commentActions, useCMS } from "@/lib/cms/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function EntryCommentsPanel({ entryId }: { entryId: string }) {
  const comments = useCMS((s) =>
    s.comments
      .filter((c) => c.entryId === entryId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  );
  const [draft, setDraft] = useState("");

  const post = () => {
    if (!draft.trim()) return;
    commentActions.add(entryId, draft);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="space-y-2">
        <Textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Leave a comment for your team…"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={post} disabled={!draft.trim()}>
            Post comment
          </Button>
        </div>
      </div>

      {comments.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-[13px] text-muted-foreground">
          No comments yet. Start the conversation above.
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-md border border-border/60 bg-[color:var(--card)] p-3 ${
                c.resolved ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-medium">{c.authorName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {timeAgo(c.createdAt)}
                </div>
              </div>
              <div className="mt-1 whitespace-pre-wrap text-[13px]">{c.body}</div>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => commentActions.toggleResolved(c.id)}
                >
                  {c.resolved ? "Reopen" : "Resolve"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => commentActions.remove(c.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
