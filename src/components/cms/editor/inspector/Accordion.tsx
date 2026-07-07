import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ICON_STROKE } from "@/lib/cms/icons";

interface Props {
  title: string;
  defaultOpen?: boolean;
  count?: number;
  /**
   * When provided, the open/closed state for this group is persisted to
   * localStorage under `bettercms.inspector.accordion.<storageKey>`.
   * If absent, the accordion behaves as an uncontrolled toggle.
   */
  storageKey?: string;
  children: ReactNode;
}

const LS_PREFIX = "bettercms.inspector.accordion.";

function readOpen(key: string | undefined, fallback: boolean): boolean {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(LS_PREFIX + key);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch { /* noop */ }
  return fallback;
}

/**
 * Inspector group.
 *
 * Hierarchy is carried by typography + spacing, not by hard dividers.
 * Group title is a small all-caps label; the disclosure caret sits to
 * the right. When `storageKey` is provided, open/closed state survives
 * reloads (debounced 200ms).
 */
export function InspectorAccordion({
  title,
  defaultOpen = true,
  count,
  storageKey,
  children,
}: Props) {
  const [open, setOpen] = useState(() => readOpen(storageKey, defaultOpen));

  // Debounced persist.
  const writeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    if (writeRef.current) clearTimeout(writeRef.current);
    writeRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(LS_PREFIX + storageKey, open ? "1" : "0");
      } catch { /* noop */ }
    }, 200);
    return () => {
      if (writeRef.current) clearTimeout(writeRef.current);
    };
  }, [open, storageKey]);

  return (
    <section className="-mx-3.5 border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 px-3.5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
      >
        <span className="flex-1 truncate">{title}</span>
        {typeof count === "number" && (
          <span className="rounded bg-[color:var(--s4)] px-1.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
            {count}
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-muted-foreground/70 transition-transform duration-150 ${
            open ? "" : "-rotate-90"
          }`}
          strokeWidth={ICON_STROKE}
        />
      </button>
      {open && <div className="space-y-3 px-3.5 pb-4">{children}</div>}
    </section>
  );
}
