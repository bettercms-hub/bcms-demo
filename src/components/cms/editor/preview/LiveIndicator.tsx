/** Live sync indicator: shows "Live" when synced, briefly pulses "Updated" after edits. */
import { useEffect, useRef, useState } from "react";

interface Props {
  /** Stamp that changes whenever the current node's content changes (e.g. updatedAt). */
  stamp?: string | number;
}

export function LiveIndicator({ stamp }: Props) {
  const last = useRef<string | number | undefined>(stamp);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (stamp === undefined) return;
    if (last.current === undefined) {
      last.current = stamp;
      return;
    }
    if (stamp !== last.current) {
      last.current = stamp;
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 900);
      return () => clearTimeout(t);
    }
  }, [stamp]);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
      title={pulsing ? "Preview just updated" : "Preview is live"}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulsing && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      <span className="tabular-nums">{pulsing ? "Updated" : "Live"}</span>
    </span>
  );
}
