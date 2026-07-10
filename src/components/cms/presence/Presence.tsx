/**
 * Presence UI — avatar, overlapping stack, and the top-bar popover.
 *
 * Design rules (from the Webflow/Sanity/Figma/Notion study):
 * - One accent color per person unifies every signal (ring, cursor, outline).
 * - Small and quiet: 24px in the top bar, 18px on rows, max 3 + "+N".
 * - Idle people fade; they never show cursors or outlines.
 * - Every avatar is a navigation affordance: click → jump to where they are.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { useCMS } from "@/lib/cms/store";
import { peerLocationLabel, useProjectPresence, type PresencePeer } from "@/lib/workspace/presence-store";
import { PersonTooltip } from "@/components/cms/workflow/PersonTooltip";
import { cn } from "@/lib/utils";

export function PresenceAvatar({
  peer,
  size = 24,
  ring = true,
  className,
  /** Rich hover card (photo, name, role, location). Off inside the popover. */
  withTooltip = true,
}: {
  peer: PresencePeer;
  size?: number;
  ring?: boolean;
  className?: string;
  withTooltip?: boolean;
}) {
  // Presence peers are real teammates: pull their photo and role for the card.
  const member = useCMS((s) => s.members.find((m) => m.id === peer.id));
  const dot = (
    <span
      className={cn(
        "grid shrink-0 select-none place-items-center rounded-full font-semibold text-white outline-none transition-opacity",
        peer.status === "idle" && "opacity-40",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, Math.round(size * 0.38)),
        backgroundColor: peer.color,
        boxShadow: ring ? `0 0 0 2px var(--card)` : undefined,
      }}
      {...(withTooltip ? { tabIndex: 0 } : { title: `${peer.name} · ${peerLocationLabel(peer)}` })}
    >
      {peer.initials}
    </span>
  );
  if (!withTooltip) return dot;
  return (
    <PersonTooltip
      name={peer.name}
      role={member?.role ?? peer.seat}
      avatarUrl={member?.avatarUrl}
      initials={peer.initials}
      color={peer.color}
      meta={peerLocationLabel(peer)}
    >
      {dot}
    </PersonTooltip>
  );
}

/** Overlapping stack, max N + overflow counter. */
export function PresenceStack({
  peers,
  size = 20,
  max = 3,
  className,
}: {
  peers: PresencePeer[];
  size?: number;
  max?: number;
  className?: string;
}) {
  if (!peers.length) return null;
  const shown = peers.slice(0, max);
  const extra = peers.length - shown.length;
  return (
    <span className={cn("flex items-center", className)} style={{ paddingLeft: 4 }}>
      {shown.map((p) => (
        <PresenceAvatar key={p.id} peer={p} size={size} className="-ml-1 first:ml-0" />
      ))}
      {extra > 0 && (
        <span
          className="-ml-1 grid shrink-0 place-items-center rounded-full bg-[color:var(--s2)] font-semibold text-muted-foreground"
          style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.38)), boxShadow: "0 0 0 2px var(--card)" }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/**
 * Top-bar presence: avatar stack + a popover grouped into "On this page"
 * and "Elsewhere in this project", each row clickable to jump there.
 */
export function TopBarPresence() {
  const { workspace, project } = useParams({ strict: false }) as { workspace?: string; project?: string };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search }) as { page?: string };
  const navigate = useNavigate();
  const pr = workspace && project ? getProjectBySlug(workspace, project) : undefined;
  const peers = useProjectPresence(pr?.id);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!pr || !workspace || !project || !peers.length) return null;

  const onVisual = pathname.endsWith("/visual");
  const currentPage = onVisual ? search.page ?? "/" : null;
  const here = peers.filter((p) => p.status === "active" && p.surface === "canvas" && p.pagePath === currentPage);
  const elsewhere = peers.filter((p) => !here.includes(p));

  function jumpTo(peer: PresencePeer) {
    setOpen(false);
    if (peer.surface === "canvas" && peer.pagePath) {
      navigate({
        to: "/w/$workspace/p/$project/visual",
        params: { workspace: workspace!, project: project! },
        search: { page: peer.pagePath },
      });
    } else if (peer.surface === "entry" && peer.collectionId) {
      navigate({
        to: "/w/$workspace/p/$project/editor",
        params: { workspace: workspace!, project: project! },
        search: { scope: "collections", node: peer.collectionId, section: undefined },
      });
    } else {
      navigate({
        to: "/w/$workspace/p/$project/content",
        params: { workspace: workspace!, project: project! },
      });
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${peers.length} teammates in this project`}
        aria-expanded={open}
        className="flex h-8 items-center rounded-md px-1.5 transition-colors hover:bg-[color:var(--color-row-hover)]"
      >
        <PresenceStack peers={peers} size={22} max={3} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[80] mt-1.5 w-[264px] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] py-1.5 shadow-xl">
          {onVisual && (
            <PresenceGroup
              label={`On this page · ${here.length}`}
              peers={here}
              empty="Only you"
              onJump={jumpTo}
              current
            />
          )}
          <PresenceGroup
            label={onVisual ? `Elsewhere in ${pr.name} · ${elsewhere.length}` : `In ${pr.name} · ${peers.length}`}
            peers={onVisual ? elsewhere : peers}
            empty="No one else right now"
            onJump={jumpTo}
          />
          <div className="mt-1 border-t border-[color:var(--border-hairline)] px-3 pb-1 pt-2 text-[10.5px] text-muted-foreground">
            Click a person to jump to where they are.
          </div>
        </div>
      )}
    </div>
  );
}

function PresenceGroup({
  label,
  peers,
  empty,
  onJump,
  current = false,
}: {
  label: string;
  peers: PresencePeer[];
  empty: string;
  onJump: (p: PresencePeer) => void;
  current?: boolean;
}) {
  return (
    <div className="px-1.5 pb-1">
      <div className="px-1.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
        {label}
      </div>
      {peers.length === 0 ? (
        <div className="px-1.5 pb-1 text-[12px] text-muted-foreground">{empty}</div>
      ) : (
        peers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onJump(p)}
            disabled={current}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors",
              !current && "hover:bg-[color:var(--color-row-hover)]",
            )}
          >
            <PresenceAvatar peer={p} size={24} ring={false} withTooltip={false} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-foreground">{p.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{peerLocationLabel(p)}</span>
            </span>
            {p.status === "active" && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
            )}
          </button>
        ))
      )}
    </div>
  );
}
