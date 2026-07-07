import type { ReactNode } from "react";
import { Monitor, Smartphone, Tablet, RefreshCw } from "lucide-react";

export type PreviewDevice = "desktop" | "tablet" | "mobile";
export type PreviewZoom = 0.5 | 0.75 | 1 | "fit";

export const DEVICE_WIDTH: Record<PreviewDevice, number> = {
  desktop: 1280, tablet: 834, mobile: 390,
};

interface Props {
  device: PreviewDevice;
  onDevice: (d: PreviewDevice) => void;
  zoom: PreviewZoom;
  onZoom: (z: PreviewZoom) => void;
  onRefresh?: () => void;
  /** Left-aligned slot, rendered before the device buttons. */
  leftSlot?: ReactNode;
  /** Small status chip (e.g. "Published · 3d ago"). */
  chip?: ReactNode;
}

export function PreviewToolbar({ device, onDevice, zoom, onZoom, onRefresh, leftSlot, chip }: Props) {
  const Btn = ({ on, active, title, children }: { on: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button type="button" title={title} onClick={on}
      className={`grid h-7 w-7 place-items-center rounded-[4px] ${active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
      {children}
    </button>
  );
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 overflow-hidden border-b border-border bg-background px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {leftSlot}
        <div className="flex shrink-0 items-center gap-0.5">
          <Btn title={`Desktop · ${DEVICE_WIDTH.desktop}px`} on={() => onDevice("desktop")} active={device === "desktop"}><Monitor className="h-3.5 w-3.5" /></Btn>
          <Btn title={`Tablet · ${DEVICE_WIDTH.tablet}px`} on={() => onDevice("tablet")} active={device === "tablet"}><Tablet className="h-3.5 w-3.5" /></Btn>
          <Btn title={`Mobile · ${DEVICE_WIDTH.mobile}px`} on={() => onDevice("mobile")} active={device === "mobile"}><Smartphone className="h-3.5 w-3.5" /></Btn>
        </div>
        {chip && <span className="hidden min-w-0 truncate lg:inline-flex">{chip}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <select
          value={String(zoom)}
          onChange={(e) => {
            const v = e.target.value;
            onZoom(v === "fit" ? "fit" : (Number(v) as PreviewZoom));
          }}
          aria-label="Zoom"
          className="h-7 rounded-[4px] border border-border bg-surface px-2 text-[11px]"
        >
          <option value="0.5">50%</option>
          <option value="0.75">75%</option>
          <option value="1">100%</option>
          <option value="fit">Fit</option>
        </select>
        {onRefresh && (
          <Btn title="Refresh" on={onRefresh}><RefreshCw className="h-3.5 w-3.5" /></Btn>
        )}
      </div>
    </div>
  );
}
