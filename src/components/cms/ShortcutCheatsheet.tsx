import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SHORTCUTS, formatShortcut } from "@/lib/cms/shortcuts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutCheatsheet({ open, onOpenChange }: Props) {
  const groups = SHORTCUTS.reduce<Record<string, typeof SHORTCUTS>>((acc, s) => {
    (acc[s.group] = acc[s.group] ?? []).push(s);
    return acc;
  }, {});
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-1 gap-x-8 gap-y-5 overflow-auto md:grid-cols-2">
          {Object.entries(groups).map(([group, items]) => (
            <section key={group}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</div>
              <ul className="space-y-1.5">
                {items.map((s) => (
                  <li key={s.keys} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-foreground">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.includes(" ")
                        ? s.keys.split(" ").map((k, i) => (
                            <Kbd key={i}>{k.toUpperCase()}</Kbd>
                          ))
                        : formatShortcut(s.keys).map((k, i) => <Kbd key={i}>{k}</Kbd>)}
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-[4px] border border-border bg-surface px-1.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}
