import { cn } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";
import type { CommentThread } from "@/lib/comments/types";

interface CommentPinProps {
  thread?: CommentThread;
  active?: boolean;
  pending?: boolean;
  initial?: string;
  count?: number;
  isAi?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function CommentPin({
  thread,
  active,
  pending,
  initial,
  count,
  isAi,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: CommentPinProps) {
  const resolved = thread?.status === "resolved";
  const ai = isAi ?? thread?.messages?.some((m) => m.author_kind === "ai");
  const label =
    initial ??
    thread?.messages?.[0]?.body
      ?.trim()
      .charAt(0)
      .toUpperCase() ??
    "·";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "group/cpin relative grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold transition-all duration-150",
        "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] ring-1 ring-black/10",
        "hover:scale-110",
        resolved
          ? "bg-muted/70 text-muted-foreground/80 ring-border/30 hover:bg-muted"
          : ai
          ? "bg-violet-500 text-white shadow-[0_0_18px_-4px_rgba(139,92,246,0.7)]"
          : "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]",
        active && "scale-110 ring-2 ring-[color:var(--ring)] ring-offset-2 ring-offset-[color:var(--canvas)]",
        pending && "animate-pulse",
      )}
      aria-label={
        resolved ? "Resolved comment" : ai ? "Comment with AI" : "Comment thread"
      }
    >
      {resolved ? (
        <Check className="h-3 w-3" strokeWidth={3} />
      ) : ai ? (
        <Sparkles className="h-3 w-3" strokeWidth={2.5} />
      ) : (
        <span>{label}</span>
      )}
      {count && count > 1 ? (
        <span className="absolute -bottom-1 -right-1 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background ring-1 ring-[color:var(--canvas)]">
          {count}
        </span>
      ) : null}
    </button>
  );
}
