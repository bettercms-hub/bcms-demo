import type { ReactNode } from "react";
import { DEVICE_WIDTH, type PreviewDevice, type PreviewZoom } from "./PreviewToolbar";

interface Props {
  device: PreviewDevice;
  zoom: PreviewZoom;
  label?: string;
  children: ReactNode;
}

export function PreviewFrame({ device, zoom, label, children }: Props) {
  const width = DEVICE_WIDTH[device];
  const scale = zoom === "fit" ? undefined : zoom;
  return (
    <div className="relative">
      {label && (
        <div className="sticky top-0 z-10 mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow-sm">
          {label}
        </div>
      )}
      <div
        className="bcms-preview-surface mx-auto overflow-hidden rounded-[10px] border border-border bg-white shadow-sm transition-[width,max-width,transform] duration-300 ease-out"
        style={
          scale
            ? { width, transform: `scale(${scale})`, transformOrigin: "top center" }
            : { width: "100%", maxWidth: width }
        }
      >
        {children}
      </div>
    </div>
  );
}
