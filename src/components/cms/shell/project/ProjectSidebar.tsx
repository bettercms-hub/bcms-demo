import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ContentTree } from "@/components/cms/ContentTree";
import { editorBus } from "@/lib/cms/editor-bus";

type Scope = "pages" | "collections" | "components";

interface Props {
  wsSlug: string;
  projectSlug: string;
  pathname: string;
}

const STORAGE_KEY = "bcms:project-sidebar:width";
const COLLAPSED_KEY = "bcms:project-sidebar:collapsed";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

function readStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
}

export function ProjectSidebar({ wsSlug, projectSlug, pathname }: Props) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { scope?: Scope; node?: string };

  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const draggingRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    setWidth(readStoredWidth());
    setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  // Editor toolbar's PanelLeft button toggles us over the bus.
  useEffect(() => {
    return editorBus.on((e) => {
      if (e.type === "editor:toggle-panel" && e.side === "left") {
        setCollapsed((c) => {
          const next = !c;
          try {
            window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
          } catch {
            /* noop */
          }
          return next;
        });
      }
    });
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingRef.current = { startX: e.clientX, startWidth: width };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        const d = draggingRef.current;
        if (!d) return;
        const next = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, d.startWidth + (ev.clientX - d.startX)),
        );
        setWidth(next);
      };
      const onUp = () => {
        const d = draggingRef.current;
        draggingRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (d) {
          try {
            window.localStorage.setItem(STORAGE_KEY, String(Math.round(d.startWidth)));
          } catch {
            /* noop */
          }
          // Persist the *current* width, not start width.
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [width],
  );

  // Persist width on change after dragging settles.
  useEffect(() => {
    if (draggingRef.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
    } catch {
      /* noop */
    }
  }, [width]);

  const resetWidth = () => setWidth(DEFAULT_WIDTH);

  const onEditor = pathname.includes("/editor");
  if (!onEditor) return null;

  return (
    <aside
      aria-label="Project content"
      aria-hidden={collapsed}
      style={{ width: collapsed ? 0 : width }}
      className={`relative hidden shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar md:flex ${
        draggingRef.current ? "" : "transition-[width] duration-200 ease-out"
      }`}
    >
      {/* Fixed-width inner shell so content slides out instead of reflowing. */}
      <div
        style={{ width }}
        className={`flex h-full min-h-0 flex-col transition-opacity duration-150 ${
          collapsed ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <ContentTree
          scope={search.scope ?? "pages"}
          selectedId={search.node}
          onSelect={(id) =>
            navigate({
              to: "/w/$workspace/p/$project/editor",
              params: { workspace: wsSlug, project: projectSlug },
              search: { scope: search.scope ?? "pages", node: id },
              replace: true,
            })
          }
        />
      </div>
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={onPointerDown}
          onDoubleClick={resetWidth}
          className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize"
        >
          <div className="mx-auto h-full w-px bg-transparent transition-colors group-hover:bg-border-strong" />
        </div>
      )}
    </aside>
  );
}
