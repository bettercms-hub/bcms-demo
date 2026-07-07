import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mentionablesQueryOptions } from "@/lib/comments/queries";
import type { Mention } from "@/lib/comments/types";
import { cn } from "@/lib/utils";
import { Sparkles, User } from "lucide-react";

interface Props {
  workspaceId: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string, mentions: Mention[]) => void;
  mentions: Mention[];
}

export function MentionCombobox({
  workspaceId,
  textareaRef,
  value,
  onChange,
  mentions,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const tokenStart = useRef<number | null>(null);

  const { data: items = [] } = useQuery(
    mentionablesQueryOptions({ workspaceId, query }),
  );

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    function handle() {
      if (!ta) return;
      const cursor = ta.selectionStart ?? 0;
      const upToCursor = ta.value.slice(0, cursor);
      const match = /(?:^|\s)@([\w-]*)$/.exec(upToCursor);
      if (match) {
        tokenStart.current = cursor - match[1].length - 1;
        setQuery(match[1]);
        setOpen(true);
        setHighlight(0);
      } else {
        setOpen(false);
        tokenStart.current = null;
      }
    }
    ta.addEventListener("input", handle);
    ta.addEventListener("click", handle);
    ta.addEventListener("keyup", handle);
    return () => {
      ta.removeEventListener("input", handle);
      ta.removeEventListener("click", handle);
      ta.removeEventListener("keyup", handle);
    };
  }, [textareaRef]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !open) return;
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        const pick = items[highlight];
        if (pick) {
          e.preventDefault();
          insert(pick);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    ta.addEventListener("keydown", onKey);
    return () => ta.removeEventListener("keydown", onKey);
  }, [open, items, highlight, textareaRef]);

  function insert(pick: (typeof items)[number]) {
    const ta = textareaRef.current;
    if (!ta || tokenStart.current == null) return;
    const start = tokenStart.current;
    const cursor = ta.selectionStart ?? value.length;
    const next =
      value.slice(0, start) + `@${pick.label} ` + value.slice(cursor);
    const newMentions: Mention[] = [
      ...mentions.filter((m) => m.ref !== pick.id),
      { kind: pick.kind, ref: pick.id, label: pick.label },
    ];
    onChange(next, newMentions);
    setOpen(false);
    requestAnimationFrame(() => {
      const pos = start + pick.label.length + 2;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  if (!open || items.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 max-h-56 w-64 overflow-y-auto rounded-md border border-border/60 bg-[color:var(--s2)] py-1 shadow-lg">
      {items.map((m, i) => (
        <button
          key={`${m.kind}-${m.id}`}
          type="button"
          onMouseEnter={() => setHighlight(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            insert(m);
          }}
          className={cn(
            "flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px]",
            i === highlight && "bg-[color:var(--color-row-hover)]",
          )}
        >
          {m.kind === "agent" ? (
            <Sparkles className="h-3 w-3 text-violet-400" />
          ) : (
            <User className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="font-medium">{m.label}</span>
          {m.sublabel && (
            <span className="ml-auto truncate text-[10px] text-muted-foreground">
              {m.sublabel}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
