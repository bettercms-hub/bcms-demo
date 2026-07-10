/**
 * PresenceCanvasLayer — live multiplayer signals on the visual editor canvas.
 *
 * Two signals, both positioned inside the canvas's relative root (the same
 * pattern CommentLayer uses) so they scroll with the page:
 *
 * 1. Named cursors (Figma/Framer): a pointer + name chip per active peer on
 *    THIS page, drifting smoothly between simulated positions via a CSS
 *    transform transition tuned to the presence tick.
 * 2. Section outline (Webflow): a colored ring + name tag on the section a
 *    peer is editing — the "don't step on me" signal.
 *
 * Idle peers show nothing here (they stay in the avatar stack, faded).
 */
import { useEffect, useMemo, useState } from "react";
import { PRESENCE_TICK_MS, type PresencePeer } from "@/lib/workspace/presence-store";

interface Placed {
  peer: PresencePeer;
  cursor?: { x: number; y: number };
  outline?: { top: number; left: number; width: number; height: number };
}

export function PresenceCanvasLayer({
  peers,
  pagePath,
  containerRef,
  recalcKey,
}: {
  peers: PresencePeer[];
  pagePath: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  recalcKey?: unknown;
}) {
  const onPage = useMemo(
    () => peers.filter((p) => p.status === "active" && p.surface === "canvas" && p.pagePath === pagePath),
    [peers, pagePath],
  );
  const [placed, setPlaced] = useState<Placed[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      const root = containerRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const out: Placed[] = [];
      for (const peer of onPage) {
        if (!peer.sectionId) continue;
        const el = root.querySelector<HTMLElement>(`[data-sec="${peer.sectionId}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const top = r.top - rootRect.top;
        const left = r.left - rootRect.left;
        const item: Placed = {
          peer,
          outline: { top, left, width: r.width, height: r.height },
        };
        if (peer.cursor) {
          item.cursor = {
            x: left + peer.cursor.fx * r.width,
            y: top + peer.cursor.fy * r.height,
          };
        }
        out.push(item);
      }
      setPlaced(out);
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [onPage, containerRef, recalcKey]);

  if (!placed.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[45]" aria-hidden>
      {/* Section outlines with name tags */}
      {placed.map(
        ({ peer, outline }) =>
          outline && (
            <div
              key={`o_${peer.id}`}
              className="absolute transition-all duration-500 ease-out"
              style={{ top: outline.top, left: outline.left, width: outline.width, height: outline.height }}
            >
              <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 0 2px ${peer.color}` }} />
              <span
                className="absolute left-0 top-0 max-w-[160px] truncate rounded-br-md px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: peer.color }}
              >
                {peer.name}
              </span>
            </div>
          ),
      )}

      {/* Live cursors */}
      {placed.map(
        ({ peer, cursor }) =>
          cursor && (
            <div
              key={`c_${peer.id}`}
              className="absolute left-0 top-0 will-change-transform"
              style={{
                transform: `translate(${cursor.x}px, ${cursor.y}px)`,
                transition: `transform ${PRESENCE_TICK_MS}ms cubic-bezier(0.25, 0.6, 0.3, 1)`,
              }}
            >
              <svg width="15" height="17" viewBox="0 0 15 17" fill="none" className="drop-shadow-sm">
                <path
                  d="M1 1L13.5 8.2L7.6 9.6L4.8 15.6L1 1Z"
                  fill={peer.color}
                  stroke="white"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className="absolute left-3 top-3.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                style={{ backgroundColor: peer.color }}
              >
                {peer.name.split(" ")[0]}
              </span>
            </div>
          ),
      )}
    </div>
  );
}
