import { Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, Eye, Maximize2, Minimize2, Rows3 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { editorBus } from "@/lib/cms/editor-bus";
import { useEditorDensity, type EditorDensity } from "@/lib/cms/use-editor-density";

const FLAG_KEY = (flag: string) => `bettercms.editor.${flag}`;

function readFlag(flag: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(FLAG_KEY(flag));
  if (v === "1") return true;
  if (v === "0") return false;
  return fallback;
}

function useFlag(flag: "show-metadata" | "show-summaries", fallback: boolean) {
  const [value, setValue] = useState<boolean>(() => readFlag(flag, fallback));
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FLAG_KEY(flag), value ? "1" : "0");
  }, [flag, value]);
  return [value, setValue] as const;
}

const DENSITY_OPTIONS: { value: EditorDensity; label: string; icon: typeof Minimize2 }[] = [
  { value: "compact", label: "Compact", icon: Minimize2 },
  { value: "comfortable", label: "Cozy", icon: Rows3 },
  { value: "expanded", label: "Expanded", icon: Maximize2 },
];

/**
 * Editor `View ▾` menu — houses density, collapse/expand helpers, and
 * presentation flags. Keeps the toolbar clear of secondary controls so
 * only the constantly-switched workflows (Content/Split/Preview, panel
 * toggle) remain visible.
 */
export function ViewMenu() {
  const { density, setDensity } = useEditorDensity();
  const [showMetadata, setShowMetadata] = useFlag("show-metadata", true);
  const [showSummaries, setShowSummaries] = useFlag("show-summaries", true);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-[color:var(--color-row-selected)] data-[state=open]:text-foreground"
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
          View
          <ChevronDown className="h-3 w-3 opacity-70" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-[220px] p-1">
        <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Editor density
        </DropdownMenuLabel>
        {DENSITY_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = density === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => setDensity(opt.value)}
              className="flex items-center text-[13px]"
            >
              <Icon className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="flex-1">{opt.label}</span>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => editorBus.emit({ type: "editor:collapse-all" })}
          className="text-[13px]"
        >
          <ChevronsDownUp className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
          Collapse all
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => editorBus.emit({ type: "editor:expand-all" })}
          className="text-[13px]"
        >
          <ChevronsUpDown className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
          Expand all
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Show
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            const next = !showMetadata;
            setShowMetadata(next);
            editorBus.emit({ type: "editor:toggle-flag", flag: "show-metadata", value: next });
          }}
          className="text-[13px]"
        >
          <span className="flex-1">Page metadata</span>
          {showMetadata && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            const next = !showSummaries;
            setShowSummaries(next);
            editorBus.emit({ type: "editor:toggle-flag", flag: "show-summaries", value: next });
          }}
          className="text-[13px]"
        >
          <span className="flex-1">Block summaries</span>
          {showSummaries && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
