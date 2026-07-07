import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  toggleReaction,
  listReactionsForThread,
} from "@/lib/comments/reactions.functions";
import { threadReactionsQueryOptions } from "@/lib/comments/queries";
import { getCurrentUserProfile } from "@/lib/workspace/current-user";

const PICKER = ["👍", "❤️", "🎉", "😄", "🚀", "👀", "🔥", "✅"];
const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export function MessageReactions({
  threadId,
  messageId,
}: {
  threadId: string;
  messageId: string;
}) {
  const qc = useQueryClient();
  const toggleFn = useServerFn(toggleReaction);
  const { data: all = [] } = useQuery(threadReactionsQueryOptions(threadId));
  const me = getCurrentUserProfile();
  const myId = (me as { id?: string }).id ?? DEMO_USER_ID;

  const reactions = (all as Reaction[]).filter((r) => r.message_id === messageId);
  const groups = useMemo(() => {
    const m = new Map<string, { count: number; mine: boolean }>();
    for (const r of reactions) {
      const g = m.get(r.emoji) ?? { count: 0, mine: false };
      g.count += 1;
      if (r.user_id === myId) g.mine = true;
      m.set(r.emoji, g);
    }
    return Array.from(m.entries());
  }, [reactions, myId]);

  const toggle = useMutation({
    mutationFn: (emoji: string) =>
      toggleFn({ data: { messageId, emoji, userId: myId } }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["comment-reactions", threadId] }),
  });

  if (groups.length === 0) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="ml-7 mt-1 inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-[color:var(--color-row-hover)] hover:text-foreground group-hover:opacity-100"
          >
            <Smile className="h-2.5 w-2.5" />
            React
          </button>
        </PopoverTrigger>
        <EmojiPicker onPick={(e) => toggle.mutate(e)} />
      </Popover>
    );
  }

  return (
    <div className="ml-7 mt-1 flex flex-wrap items-center gap-1">
      {groups.map(([emoji, g]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => toggle.mutate(emoji)}
          className={cn(
            "inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[10.5px] transition-colors",
            g.mine
              ? "border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 text-[color:var(--primary)]"
              : "border-border/60 bg-[color:var(--s3)] text-muted-foreground hover:bg-[color:var(--color-row-hover)]",
          )}
        >
          <span>{emoji}</span>
          <span className="font-medium">{g.count}</span>
        </button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-[color:var(--color-row-hover)]"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
        </PopoverTrigger>
        <EmojiPicker onPick={(e) => toggle.mutate(e)} />
      </Popover>
    </div>
  );
}

function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <PopoverContent
      align="start"
      className="w-auto rounded-lg border border-border/60 bg-[color:var(--s2)] p-1.5 shadow-lg"
    >
      <div className="flex gap-0.5">
        {PICKER.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="grid h-7 w-7 place-items-center rounded text-base hover:bg-[color:var(--color-row-hover)]"
          >
            {e}
          </button>
        ))}
      </div>
    </PopoverContent>
  );
}

export { listReactionsForThread };
