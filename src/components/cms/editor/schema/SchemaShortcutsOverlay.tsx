/**
 * SchemaShortcutsOverlay — keyboard cheat sheet for the schema workspace.
 *
 * Opens via `?` (handled in use-schema-hotkeys) or the toolbar menu.
 * Pure presentation; no store reads.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  keys: string[];
  label: string;
}

interface Group {
  title: string;
  items: Shortcut[];
}

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

const GROUPS: Group[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["1"], label: "Builder view" },
      { keys: ["2"], label: "Table view" },
      { keys: ["3"], label: "Metadata view" },
      { keys: ["4"], label: "Relationships view" },
      { keys: ["Esc"], label: "Close sheet / clear selection" },
    ],
  },
  {
    title: "Fields",
    items: [
      { keys: ["/"], label: "Insert field…" },
      { keys: [MOD, "K"], label: "Search fields…" },
      { keys: ["⌫"], label: "Delete selected field" },
    ],
  },
  {
    title: "History",
    items: [
      { keys: [MOD, "Z"], label: "Undo" },
      { keys: [MOD, "⇧", "Z"], label: "Redo" },
    ],
  },
  {
    title: "Inspect",
    items: [
      { keys: [MOD, "J"], label: "Toggle JSON view" },
      { keys: ["?"], label: "Show this overlay" },
    ],
  },
];

export function SchemaShortcutsOverlay({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-semibold tracking-tight">
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                {g.title}
              </div>
              <ul className="space-y-1.5">
                {g.items.map((sc) => (
                  <li
                    key={sc.label}
                    className="flex items-center justify-between gap-3 text-[12px]"
                  >
                    <span className="text-foreground/85">{sc.label}</span>
                    <span className="flex items-center gap-1">
                      {sc.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border/50 bg-[color:var(--panel)] px-1.5 text-[10.5px] font-medium text-muted-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
