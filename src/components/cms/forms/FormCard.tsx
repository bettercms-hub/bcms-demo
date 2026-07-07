import { MoreHorizontal, Copy, Inbox, Code2, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FormSummary } from "@/lib/forms/types";

interface Props {
  form: FormSummary;
  onEdit: () => void;
  onDuplicate: () => void;
  onSubmissions: () => void;
  onCode: () => void;
  onDelete: () => void;
}

const STATUS_STYLE: Record<FormSummary["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  archived: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function FormCard({
  form,
  onEdit,
  onDuplicate,
  onSubmissions,
  onCode,
  onDelete,
}: Props) {
  return (
    <div className="group flex flex-col rounded-lg bg-[color:var(--card)] p-4 transition-colors hover:bg-[color:var(--elevated)]">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={onEdit}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate text-sm font-semibold text-foreground">{form.name}</div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {form.description || "No description"}
          </p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSubmissions}>
              <Inbox className="mr-2 h-3.5 w-3.5" /> View submissions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCode}>
              <Code2 className="mr-2 h-3.5 w-3.5" /> Get code
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_STYLE[form.status]}`}>
          {form.status}
        </span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">
          {form.submissionCount} {form.submissionCount === 1 ? "submission" : "submissions"}
        </span>
        {form.pagesUsing > 0 && (
          <>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              On {form.pagesUsing} {form.pagesUsing === 1 ? "page" : "pages"}
            </span>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
        <span className="text-[11px] text-muted-foreground">
          Updated {relative(form.updatedAt)}
        </span>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Open
        </Button>
      </div>
    </div>
  );
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
