import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { commentsUi, useCommentsUi } from "@/lib/cms/comments-store";
import {
  addMessage,
  createThread,
  markSuggestionApplied,
  runCommentAi,
  setThreadStatus,
} from "@/lib/comments/comments.functions";
import { markThreadRead } from "@/lib/comments/read-state.functions";
import { threadsQueryOptions } from "@/lib/comments/queries";
import {
  AI_QUICK_ACTIONS,
  AI_SYSTEM_PROMPT,
  type AnchorRef,
  type CommentSurface,
  type CommentThread,
  type Mention,
  type SuggestedEdit,
} from "@/lib/comments/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getCurrentUserProfile } from "@/lib/workspace/current-user";
import { MentionCombobox } from "./MentionCombobox";
import { MessageReactions } from "./MessageReactions";
import { uploadCommentAttachment } from "@/lib/comments/attachments";
import type { Attachment } from "@/lib/comments/types";

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60_000) return "just now";
  if (d < 3.6e6) return `${Math.round(d / 60_000)}m`;
  if (d < 8.64e7) return `${Math.round(d / 3.6e6)}h`;
  return `${Math.round(d / 8.64e7)}d`;
}

function authorBadge(thread: CommentThread, msgId: string) {
  const m = thread.messages?.find((x) => x.id === msgId);
  if (!m) return { name: "User", initials: "U", isAi: false };
  if (m.author_kind === "ai")
    return { name: "AI Collaborator", initials: "AI", isAi: true };
  if (m.author_kind === "system")
    return { name: "System", initials: "S", isAi: false };
  const me = getCurrentUserProfile();
  return { name: me.name, initials: me.initials, isAi: false };
}

interface ThreadViewProps {
  thread: CommentThread | null;
  pending: {
    surface: CommentSurface;
    workspaceId: string;
    projectId?: string;
    pageId?: string;
    anchorKind: "page" | "block" | "field" | "selection" | "element";
    anchorRef: AnchorRef;
    selectionText?: string;
  } | null;
  workspaceId: string;
  projectId?: string;
  surface: CommentSurface;
  pageId?: string;
  onClose: () => void;
  onThreadCreated?: (thread: CommentThread) => void;
  onApplySuggestion?: (suggested: SuggestedEdit, anchor: AnchorRef) => void;
  compact?: boolean;
  canSubmit?: boolean;
}

export function ThreadView({
  thread,
  pending,
  workspaceId,
  projectId,
  surface,
  pageId,
  onClose,
  onThreadCreated,
  onApplySuggestion,
  compact,
  canSubmit = true,
}: ThreadViewProps) {
  const qc = useQueryClient();
  const addFn = useServerFn(addMessage);
  const createFn = useServerFn(createThread);
  const aiFn = useServerFn(runCommentAi);
  const statusFn = useServerFn(setThreadStatus);
  const applyFn = useServerFn(markSuggestionApplied);
  const markReadFn = useServerFn(markThreadRead);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setMentions([]);
    setPendingAttachments([]);
  }, [thread?.id, pending]);

  // Mark thread as read when opened.
  useEffect(() => {
    if (thread?.id) {
      markReadFn({ data: { threadId: thread.id } }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["comment-unread", workspaceId] });
    }
  }, [thread?.id]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["comment-threads", workspaceId] });

  const sendReply = useMutation({
    mutationFn: async (text: string) => {
      if (!canSubmit) throw new Error("Comments are still loading");
      let threadId = thread?.id;
      if (thread) {
        await addFn({
          data: { threadId: thread.id, body: text, mentions, attachments: pendingAttachments },
        });
      } else if (pending) {
        const created = await createFn({
          data: {
            workspaceId,
            projectId,
            surface: pending.surface,
            pageId: pending.pageId,
            anchorKind: pending.anchorKind,
            anchorRef: pending.anchorRef,
            body: text,
            mentions,
            attachments: pendingAttachments,
          },
        });
        onThreadCreated?.(created);
        threadId = created.id;
      } else {
        throw new Error("No thread or pending");
      }

      // If user @-mentioned an AI agent, auto-trigger an AI reply.
      const aiMention = mentions.find((m) => m.kind === "agent");
      if (aiMention && threadId) {
        const selection = pending?.selectionText ?? thread?.anchor_ref?.text;
        const sysPrompt =
          aiMention.ref === "ai-seo"
            ? "You are an embedded SEO specialist. Give concrete, actionable SEO advice."
            : aiMention.ref === "ai-copy"
              ? "You are an embedded copywriter. Provide sharp, on-brand copy suggestions."
              : AI_SYSTEM_PROMPT;
        await aiFn({
          data: {
            threadId,
            systemPrompt: sysPrompt,
            userPrompt: text,
            selection: selection || undefined,
          },
        }).catch(() => {});
      }
      return { ok: true };
    },
    onSuccess: () => {
      setBody("");
      setMentions([]);
      setPendingAttachments([]);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to send"),
  });

  async function runAi(actionId: string) {
    const action = AI_QUICK_ACTIONS.find((a) => a.id === actionId);
    if (!action) return;

    // Ensure thread exists
    let threadId = thread?.id;
    const selection =
      pending?.selectionText ??
      thread?.anchor_ref?.text ??
      thread?.messages?.[0]?.body ??
      "";

    setAiBusy(true);
    try {
      if (!threadId && pending) {
        const created = await createFn({
          data: {
            workspaceId,
            projectId,
            surface: pending.surface,
            pageId: pending.pageId,
            anchorKind: pending.anchorKind,
            anchorRef: pending.anchorRef,
            body: `✨ ${action.label}${selection ? `:\n> ${selection.slice(0, 200)}` : ""}`,
          },
        });
        threadId = created.id;
        onThreadCreated?.(created);
      } else if (!threadId) {
        toast.error("Open or start a comment first");
        return;
      }
      await aiFn({
        data: {
          threadId,
          systemPrompt: AI_SYSTEM_PROMPT,
          userPrompt: action.prompt,
          selection: selection || undefined,
          produceSuggestion: action.suggestion,
        },
      });
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function resolve() {
    if (!thread) return;
    await statusFn({
      data: { threadId: thread.id, status: thread.status === "open" ? "resolved" : "open" },
    });
    invalidate();
    toast.success(thread.status === "open" ? "Resolved" : "Reopened");
  }

  async function applySuggestion(messageId: string, suggested: SuggestedEdit) {
    if (!thread) return;
    await applyFn({ data: { messageId } });
    onApplySuggestion?.(suggested, thread.anchor_ref);
    invalidate();
    toast.success("Suggestion applied");
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    try {
      for (const f of list) {
        const att = await uploadCommentAttachment(workspaceId, f);
        setPendingAttachments((prev) => [...prev, att]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f && f.type.startsWith("image/")) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      void handleFiles(files);
    }
  }

  const isComposingNew = !thread && Boolean(pending);

  return (
    <div className={cn("flex h-full flex-col", compact && "max-h-[480px]")}>
      {/* header */}
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2">
          {thread ? (
            <>
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  thread.status === "open"
                    ? "bg-[color:var(--primary)]"
                    : "bg-muted-foreground/60",
                )}
              />
              <span className="text-[12px] font-medium">
                {thread.status === "open" ? "Open thread" : "Resolved"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                · {thread.messages?.length ?? 0} reply
                {(thread.messages?.length ?? 0) === 1 ? "" : "ies"}
              </span>
            </>
          ) : (
            <span className="text-[12px] font-medium">New comment</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {thread && (
            <button
              type="button"
              onClick={resolve}
              className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              title={thread.status === "open" ? "Resolve" : "Reopen"}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {isComposingNew && pending?.selectionText && (
          <div className="rounded border-l-2 border-[color:var(--primary)] bg-[color:var(--primary)]/5 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[color:var(--primary)]/80">
              On selection
            </span>
            <span className="mt-0.5 line-clamp-2 italic">
              "{pending.selectionText}"
            </span>
          </div>
        )}
        {thread?.messages?.map((m) => {
          const meta = authorBadge(thread, m.id);
          return (
            <div key={m.id} className="group space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Avatar
                  className={cn(
                    "h-5 w-5 text-[9px]",
                    meta.isAi && "bg-violet-500/15 ring-1 ring-violet-500/40",
                  )}
                >
                  <AvatarFallback
                    className={cn(
                      "text-[9px] font-semibold",
                      meta.isAi
                        ? "bg-violet-500/20 text-violet-300"
                        : "bg-[color:var(--primary)]/15 text-[color:var(--primary)]",
                    )}
                  >
                    {meta.isAi ? <Sparkles className="h-2.5 w-2.5" /> : meta.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[11px] font-medium">{meta.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {timeAgo(m.created_at)}
                </span>
              </div>
              <div className="ml-7 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/90">
                {m.body}
              </div>
              {m.attachments && m.attachments.length > 0 && (
                <div className="ml-7 mt-1 flex flex-wrap gap-1.5">
                  {m.attachments.map((a, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightbox(a)}
                      className="overflow-hidden rounded-md border border-border/60 transition-transform hover:scale-[1.02]"
                      title={a.name}
                    >
                      <img
                        src={a.url}
                        alt={a.name}
                        className="h-20 w-20 object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
              {m.suggested_edit && (
                <SuggestedEditCard
                  suggested={m.suggested_edit}
                  applied={m.suggested_edit.applied ?? false}
                  onApply={() => applySuggestion(m.id, m.suggested_edit!)}
                />
              )}
              {thread && (
                <MessageReactions threadId={thread.id} messageId={m.id} />
              )}
            </div>
          );
        })}
        {!thread?.messages?.length && !isComposingNew && (
          <div className="py-6 text-center text-[12px] text-muted-foreground">
            No messages yet.
          </div>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-border/60 px-3 py-2">
        <div className="relative rounded-md border border-border/60 bg-[color:var(--s4)] focus-within:border-[color:var(--ring)]/60 focus-within:ring-1 focus-within:ring-[color:var(--ring)]/40">
          <MentionCombobox
            workspaceId={workspaceId}
            textareaRef={inputRef}
            value={body}
            mentions={mentions}
            onChange={(next, newMentions) => {
              setBody(next);
              setMentions(newMentions);
            }}
          />
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (body.trim() || pendingAttachments.length) {
                  sendReply.mutate(body.trim());
                }
              }
            }}
            placeholder={
              thread
                ? "Reply, @mention, or paste a screenshot…"
                : "Start a conversation… (paste or attach a screenshot)"
            }
            rows={2}
            className="w-full resize-none bg-transparent px-2.5 py-2 text-[12.5px] outline-none placeholder:text-muted-foreground/60"
          />
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-2.5 pb-2">
              {pendingAttachments.map((a, i) => (
                <div
                  key={i}
                  className="group/att relative overflow-hidden rounded-md border border-border/60"
                >
                  <img src={a.url} alt={a.name} className="h-14 w-14 object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setPendingAttachments((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover/att:opacity-100"
                    title="Remove"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {uploading && (
                <div className="grid h-14 w-14 place-items-center rounded-md border border-dashed border-border/60">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Attach screenshot or image"
                className={cn(
                  "grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground",
                  uploading && "opacity-60",
                )}
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Paperclip className="h-3 w-3" strokeWidth={2} />
                )}
              </button>
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={aiBusy}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium transition-colors",
                    "text-violet-300 hover:bg-violet-500/10",
                    aiBusy && "opacity-60",
                  )}
                >
                  {aiBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" strokeWidth={2} />
                  )}
                  Ask AI
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  AI quick actions
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {AI_QUICK_ACTIONS.map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    onSelect={() => runAi(a.id)}
                    className="text-[12px]"
                  >
                    <Sparkles className="mr-2 h-3 w-3 text-violet-400" />
                    {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
            <div className="flex items-center gap-1">
              <span className="hidden text-[10px] text-muted-foreground/60 sm:inline">
                ⌘↵
              </span>
              <button
                type="button"
                disabled={
                  !canSubmit ||
                  (!body.trim() && pendingAttachments.length === 0) ||
                  sendReply.isPending
                }
                onClick={() => sendReply.mutate(body.trim())}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-semibold transition-colors",
                  "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:bg-[color:var(--primary-hover)]",
                  "disabled:opacity-40",
                )}
              >
                {sendReply.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                {thread ? "Reply" : "Comment"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-[min(90vw,1100px)] border-border/60 bg-[color:var(--s1)] p-2">
          {lightbox && (
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="max-h-[80vh] w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SuggestedEditCard({
  suggested,
  applied,
  onApply,
}: {
  suggested: SuggestedEdit;
  applied: boolean;
  onApply: () => void;
}) {
  return (
    <div className="ml-7 mt-1.5 overflow-hidden rounded-md border border-violet-500/30 bg-violet-500/[0.04]">
      <div className="flex items-center justify-between border-b border-violet-500/20 px-2 py-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
          <Sparkles className="h-2.5 w-2.5" /> Suggested edit
        </span>
        {applied ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
            <Check className="h-2.5 w-2.5" strokeWidth={3} /> Applied
          </span>
        ) : (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onApply}
              className="rounded bg-[color:var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--primary-foreground)] hover:bg-[color:var(--primary-hover)]"
            >
              Accept
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-[color:var(--color-row-hover)]"
            >
              Reject
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 divide-y divide-violet-500/15 text-[11.5px] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="space-y-0.5 p-2">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Before
          </div>
          <div className="whitespace-pre-wrap text-foreground/70 line-through decoration-rose-500/40">
            {suggested.before}
          </div>
        </div>
        <div className="space-y-0.5 p-2">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
            After
          </div>
          <div className="whitespace-pre-wrap text-foreground/90">
            {suggested.after}
          </div>
        </div>
      </div>
    </div>
  );
}

// re-export for convenience
export { MoreHorizontal };
