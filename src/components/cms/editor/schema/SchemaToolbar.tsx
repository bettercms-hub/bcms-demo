/**
 * SchemaToolbar — slim top bar above the schema workspace (v5.4).
 *
 * Left:   Back · Collection ▸ Schema · status
 * Center: Builder / Table / Relationships
 * Right:  + New group · Undo/Redo · History · Preview API · ⋯
 *
 * Technical actions (Metadata, Generate types, JSON, Export, Shortcuts,
 * Settings) live in the overflow menu.
 */
import {
  ArrowLeft,
  ChevronRight,
  Code2,
  FileJson,
  History,
  Keyboard,
  MoreHorizontal,
  Plus,
  Redo2,
  Settings2,
  Sliders,
  Undo2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SchemaOwnerKind } from "@/lib/cms/center-bus";
import { NODE_KIND_ICON } from "@/lib/cms/icons";
import { toast } from "sonner";
import type { SchemaView } from "./SchemaCanvas";

export type SchemaStatus = "saved" | "unsaved" | "published" | "draft";

interface Props {
  ownerName: string;
  ownerKind: SchemaOwnerKind;
  schemaTitle: string;
  status: SchemaStatus;
  view: SchemaView;
  onViewChange: (v: SchemaView) => void;
  onBack: () => void;
  onAddGroup: () => void;
  onOpenApi: () => void;
  onOpenSettings: () => void;
  onOpenJson: () => void;
  onOpenMetadata: () => void;
  onOpenShortcuts: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const STATUS_LABEL: Record<SchemaStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  published: "Published",
  draft: "Draft",
};
const STATUS_DOT: Record<SchemaStatus, string> = {
  saved: "bg-emerald-500/80",
  unsaved: "bg-amber-500/80",
  published: "bg-emerald-500/80",
  draft: "bg-muted-foreground/60",
};

const VIEW_LABEL: Record<SchemaView, string> = {
  builder: "Builder",
  table: "Table",
  metadata: "Metadata",
  relationships: "Relationships",
};
// Metadata is now in the overflow menu.
const VIEW_ORDER: SchemaView[] = ["builder", "table", "relationships"];

export function SchemaToolbar({
  ownerName,
  ownerKind,
  schemaTitle,
  status,
  view,
  onViewChange,
  onBack,
  onAddGroup,
  onOpenApi,
  onOpenSettings,
  onOpenJson,
  onOpenMetadata,
  onOpenShortcuts,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: Props) {
  const KindIcon = NODE_KIND_ICON[ownerKind];
  return (
    <div className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border/30 bg-[color:var(--card)] px-4">
      {/* LEFT */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="mx-1 h-4 w-px bg-border/40" />
        <div className="flex min-w-0 items-center gap-1.5">
          <KindIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-[12.5px] text-muted-foreground">{ownerName}</span>
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          <span className="truncate text-[13px] font-semibold tracking-tight">{schemaTitle}</span>
          <span className="ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--row-hover)] px-2 py-0.5 text-[10.5px] text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      {/* CENTER — view switcher */}
      <div className="inline-flex items-center gap-0.5 rounded-md bg-[color:var(--row-hover)] p-0.5">
        {VIEW_ORDER.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={`inline-flex h-6 items-center rounded px-2.5 text-[11.5px] font-medium tracking-tight transition-colors ${
              view === v
                ? "bg-[color:var(--card)] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>

      {/* RIGHT */}
      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={onAddGroup}
          className="mr-1 inline-flex h-7 items-center gap-1.5 rounded-md border border-border/50 bg-[color:var(--card)] px-2 text-[12px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-[color:var(--row-hover)]"
        >
          <Plus className="h-3.5 w-3.5" /> New group
        </button>
        <IconBtn icon={Undo2} label="Undo" onClick={onUndo} disabled={!canUndo} />
        <IconBtn icon={Redo2} label="Redo" onClick={onRedo} disabled={!canRedo} />
        <div className="mx-1 h-4 w-px bg-border/40" />
        <ToolBtn icon={History} label="History" onClick={() => toast.message("Coming soon")} />
        <ToolBtn icon={FileJson} label="Preview API" onClick={onOpenApi} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
              aria-label="More schema actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={onOpenSettings}>
              <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Collection settings…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenMetadata}>
              <Sliders className="mr-1.5 h-3.5 w-3.5" /> Schema metadata…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenJson}>
              <FileJson className="mr-1.5 h-3.5 w-3.5" /> View JSON…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.message("Coming soon")}>
              <Code2 className="mr-1.5 h-3.5 w-3.5" /> Generate types
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenShortcuts}>
              <Keyboard className="mr-1.5 h-3.5 w-3.5" /> Keyboard shortcuts…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => toast.message("Coming soon")}>
              Duplicate schema
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.message("Coming soon")}>
              Import schema…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.message("Coming soon")}>
              Export JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function ToolBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
