import { useEffect, useRef, useState } from "react";
import { Crop as CropIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Crop rectangle in fractions of the displayed image (0..1). */
interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ASPECTS: { id: string; label: string; ratio: number | null }[] = [
  { id: "free", label: "Free", ratio: null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "3:4", label: "3:4", ratio: 3 / 4 },
];

type DragMode = null | "move" | "nw" | "ne" | "sw" | "se";

/**
 * Canvas-based image cropper. Drag the box to move it, pull a corner to
 * resize, optionally lock an aspect ratio, then Crop to export a new image.
 * Works fully offline for uploaded (data URL) images; remote images are drawn
 * with CORS so the canvas can export, with a clear message if that's blocked.
 */
export function ImageCropDialog({
  open,
  onOpenChange,
  src,
  title = "Crop image",
  onCropped,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  src: string;
  title?: string;
  onCropped: (dataUrl: string, size: { width: number; height: number }) => void;
}) {
  const [rect, setRect] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [aspect, setAspect] = useState<string>("free");
  const [loaded, setLoaded] = useState(false);
  const [working, setWorking] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; start: CropRect } | null>(null);

  // Reset the crop box whenever a new image opens.
  useEffect(() => {
    if (open) {
      setRect({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
      setAspect("free");
      setLoaded(false);
    }
  }, [open, src]);

  const ratio = ASPECTS.find((a) => a.id === aspect)?.ratio ?? null;

  function applyAspect(r: CropRect, frame: { w: number; h: number }): CropRect {
    if (!ratio) return r;
    // Keep width, derive height in pixels, convert back to fractions.
    const pxW = r.w * frame.w;
    const pxH = pxW / ratio;
    let h = pxH / frame.h;
    let y = r.y;
    if (y + h > 1) {
      h = 1 - y;
    }
    return { ...r, h };
  }

  function onPointerDown(e: React.PointerEvent, mode: DragMode) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: rect };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame) return;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const dx = (e.clientX - drag.startX) / fw;
    const dy = (e.clientY - drag.startY) / fh;
    let next = { ...drag.start };

    if (drag.mode === "move") {
      next.x = clamp(drag.start.x + dx, 0, 1 - drag.start.w);
      next.y = clamp(drag.start.y + dy, 0, 1 - drag.start.h);
    } else {
      // Corner resize. Anchor the opposite corner.
      let { x, y, w, h } = drag.start;
      const right = x + w;
      const bottom = y + h;
      if (drag.mode === "nw") {
        x = clamp(x + dx, 0, right - 0.05);
        y = clamp(y + dy, 0, bottom - 0.05);
        w = right - x;
        h = bottom - y;
      } else if (drag.mode === "ne") {
        y = clamp(y + dy, 0, bottom - 0.05);
        w = clamp(w + dx, 0.05, 1 - x);
        h = bottom - y;
      } else if (drag.mode === "sw") {
        x = clamp(x + dx, 0, right - 0.05);
        w = right - x;
        h = clamp(h + dy, 0.05, 1 - y);
      } else if (drag.mode === "se") {
        w = clamp(w + dx, 0.05, 1 - x);
        h = clamp(h + dy, 0.05, 1 - y);
      }
      next = applyAspect({ x, y, w, h }, { w: fw, h: fh });
    }
    setRect(next);
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function chooseAspect(id: string) {
    setAspect(id);
    const frame = frameRef.current;
    if (frame) setRect((r) => applyAspect(r, { w: frame.clientWidth, h: frame.clientHeight }));
  }

  function doCrop() {
    const img = imgRef.current;
    if (!img) return;
    setWorking(true);
    try {
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      const sx = Math.round(rect.x * nw);
      const sy = Math.round(rect.y * nh);
      const sw = Math.max(1, Math.round(rect.w * nw));
      const sh = Math.max(1, Math.round(rect.h * nh));
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-2d-context");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const dataUrl = canvas.toDataURL("image/png");
      onCropped(dataUrl, { width: sw, height: sh });
      onOpenChange(false);
    } catch {
      toast.error("This image can't be cropped in the browser (its host blocks it). Try an uploaded image.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Drag the box to reposition, pull a corner to resize.</DialogDescription>
        </DialogHeader>

        {/* Aspect presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => chooseAspect(a.id)}
              className={`h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors ${
                aspect === a.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Crop stage */}
        <div className="grid place-items-center rounded-lg border border-border bg-[color:var(--s1)] p-3">
          <div
            ref={frameRef}
            className="relative max-h-[46vh] select-none touch-none"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ lineHeight: 0 }}
          >
            <img
              ref={imgRef}
              src={src}
              crossOrigin="anonymous"
              alt=""
              draggable={false}
              onLoad={() => setLoaded(true)}
              className="max-h-[46vh] max-w-full rounded"
            />
            {loaded && (
              <>
                {/* Dim overlay outside the crop box (4 bands) */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute bg-black/45" style={{ left: 0, top: 0, right: 0, height: `${rect.y * 100}%` }} />
                  <div className="absolute bg-black/45" style={{ left: 0, bottom: 0, right: 0, height: `${(1 - rect.y - rect.h) * 100}%` }} />
                  <div className="absolute bg-black/45" style={{ left: 0, top: `${rect.y * 100}%`, width: `${rect.x * 100}%`, height: `${rect.h * 100}%` }} />
                  <div className="absolute bg-black/45" style={{ right: 0, top: `${rect.y * 100}%`, width: `${(1 - rect.x - rect.w) * 100}%`, height: `${rect.h * 100}%` }} />
                </div>
                {/* Crop box */}
                <div
                  onPointerDown={(e) => onPointerDown(e, "move")}
                  className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                  style={{
                    left: `${rect.x * 100}%`,
                    top: `${rect.y * 100}%`,
                    width: `${rect.w * 100}%`,
                    height: `${rect.h * 100}%`,
                  }}
                >
                  {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                    <span
                      key={corner}
                      onPointerDown={(e) => onPointerDown(e, corner)}
                      className="absolute h-3 w-3 rounded-sm border border-black/40 bg-white"
                      style={{
                        cursor: `${corner}-resize`,
                        left: corner.includes("w") ? -6 : undefined,
                        right: corner.includes("e") ? -6 : undefined,
                        top: corner.includes("n") ? -6 : undefined,
                        bottom: corner.includes("s") ? -6 : undefined,
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!loaded || working}
            onClick={doCrop}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            <CropIcon className="h-3.5 w-3.5" /> {working ? "Cropping…" : "Crop"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
